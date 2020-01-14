/********************************************************************************
 * Copyright (C) 2017 Ericsson and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/

import { inject, injectable, postConstruct } from 'inversify';
import URI from '@theia/core/lib/common/uri';
import { ResourceProvider, Resource } from '@theia/core/lib/common';
import { OpenerService, open, WidgetOpenerOptions, Widget } from '@theia/core/lib/browser';
import { KeybindingRegistry, KeybindingScope } from '@theia/core/lib/browser/keybinding';
import { Keybinding } from '@theia/core/lib/common/keybinding';
import { UserStorageUri } from '@theia/userstorage/lib/browser';
import { KeymapsParser } from './keymaps-parser';
import * as jsoncparser from 'jsonc-parser';
import { Emitter } from '@theia/core/lib/common/event';

@injectable()
export class KeymapsService {

    @inject(ResourceProvider)
    protected readonly resourceProvider: ResourceProvider;

    @inject(KeybindingRegistry)
    protected readonly keyBindingRegistry: KeybindingRegistry;

    @inject(OpenerService)
    protected readonly opener: OpenerService;

    @inject(KeymapsParser)
    protected readonly parser: KeymapsParser;

    protected readonly changeKeymapEmitter = new Emitter<void>();
    onDidChangeKeymaps = this.changeKeymapEmitter.event;

    protected resource: Resource;

    /**
     * Initialize the keybinding service.
     */
    @postConstruct()
    protected async init(): Promise<void> {
        this.resource = await this.resourceProvider(new URI().withScheme(UserStorageUri.SCHEME).withPath('keymaps.json'));
        this.reconcile();
        if (this.resource.onDidChangeContents) {
            this.resource.onDidChangeContents(() => this.reconcile());
        }
        this.keyBindingRegistry.onKeybindingsChanged(() => this.changeKeymapEmitter.fire(undefined));
    }

    /**
     * Reconcile all the keybindings, registering them to the registry.
     */
    protected async reconcile(): Promise<void> {
        const keybindings = await this.parseKeybindings();
        this.keyBindingRegistry.setKeymap(KeybindingScope.USER, keybindings);
        this.changeKeymapEmitter.fire(undefined);
    }

    /**
     * Parsed the read keybindings.
     */
    protected async parseKeybindings(): Promise<Keybinding[]> {
        try {
            const content = await this.resource.readContents();
            return this.parser.parse(content);
        } catch (error) {
            return error;
        }
    }

    /**
     * Open the keybindings widget.
     * @param ref the optional reference for opening the widget.
     */
    open(ref?: Widget): void {
        const options: WidgetOpenerOptions = {
            widgetOptions: ref ? { area: 'main', mode: 'split-right', ref } : { area: 'main' },
            mode: 'activate'
        };
        open(this.opener, this.resource.uri, options);
    }

    /**
     * Set the keybinding in the JSON.
     * @param newKeybinding the JSON keybindings.
     */
    async setKeybinding(newKeybinding: Keybinding, oldKeybinding: string): Promise<void> {
        if (!this.resource.saveContents) {
            return;
        }
        const content = await this.resource.readContents();
        const keybindings: Keybinding[] = content ? jsoncparser.parse(content) : [];
        let newAdded = false;
        let oldRemoved = false;
        for (const keybinding of keybindings) {
            if (keybinding.command === newKeybinding.command &&
                (keybinding.context || '') === (newKeybinding.context || '') &&
                (keybinding.when || '') === (newKeybinding.when || '')) {
                newAdded = true;
                keybinding.keybinding = newKeybinding.keybinding;
            }
            if (keybinding.command === '-' + newKeybinding.command &&
                keybinding.keybinding === oldKeybinding &&
                (keybinding.context || '') === (newKeybinding.context || '') &&
                (keybinding.when || '') === (newKeybinding.when || '')) {
                oldRemoved = false;
            }
        }
        if (!newAdded) {
            keybindings.push(newKeybinding);
        }
        if (!oldRemoved) {
            keybindings.push({
                command: '-' + newKeybinding.command,
                // TODO key: oldKeybinding, see https://github.com/eclipse-theia/theia/issues/6879
                keybinding: oldKeybinding,
                context: newKeybinding.context,
                when: newKeybinding.when
            });
        }
        // TODO use preference values to get proper json settings
        // TODO handle dirty models properly
        // TODO handle race conditions properly
        await this.resource.saveContents(JSON.stringify(keybindings, undefined, 4));
    }

    /**
     * Remove the given keybinding with the given command id from the JSON.
     * @param commandId the keybinding command id.
     */
    async removeKeybinding(commandId: string): Promise<void> {
        if (!this.resource.saveContents) {
            return;
        }
        const content = await this.resource.readContents();
        const keybindings: Keybinding[] = content ? jsoncparser.parse(content) : [];
        const removedCommand = '-' + commandId;
        const filtered = keybindings.filter(a => a.command !== commandId && a.command !== removedCommand);
        // TODO use preference values to get proper json settings
        // TODO handle dirty models properly
        // TODO handle race conditions properly
        await this.resource.saveContents(JSON.stringify(filtered, undefined, 4));
    }

}
