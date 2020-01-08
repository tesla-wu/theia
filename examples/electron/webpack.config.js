/**
 * This file can be edited to customize webpack configuration.
 * In to reset delete this file and rerun yarn build again.
 */
// @ts-check
const config = require('/workspace/theia/examples/electron/gen-webpack.config.js');

/**
 * Expose bundled modules on window.theia.moduleName namespace, e.g.
 * window['theia']['@theia/core/lib/common/uri'].
 * Such syntax can be used by external code, for instance, for testing.
config.module.rules.push({
    test: /\.js$/,
    loader: require.resolve('@theia/application-manager/lib/expose-loader')
}); */

module.exports = config;