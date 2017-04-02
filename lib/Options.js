'use strict';
const extend = require('extend');
const fs = require('fs');

/**
 * Configuration Loader Function
 *
 * @function Options
 * @param {Object} options - Options values to be loaded.
 * @param {string[]} options."" - List of json files to load options from (low priority).
 * @param {string} options.auth.token - Discord authentication token.
 * @param {Object} options.command - Options for {@link Internal.Command}
 * @param {Object} options.domain - Options for {@link Internal.Domain}
 * @param {string} options.debugId - Discord user id to send error messages
 * @param {Object<string, Object>} options.modules - Collection of modules to be loaded keyed by module name. Its value is merged with `options.globals` and passed as options argument to the module.
 * @param {Object} options.globals - Options to be included in every module.
 * @param {string} options.globals.data_dir - Directory to store data files. Default: './data'
 * @param {string} options.globals.server_ip - Express server ip to bind. Default: '127.0.0.1'
 * @param {string} options.globals.server_port - Express server port to bind. Default: '8080'
 * @param {string} options.globals.server_db - Database connection Uri. Default: 'mongodb://127.0.0.1:27017/test'
 * @param {string} options.globals.server_hostname - Express server complete hostname. Default: 'localhost:8080'
 * @return {Object} options - Merged options values.
 */
module.exports = (options) => {
    if (!options) options = {};

    var globals = {
        data_dir: process.env.OPENSHIFT_DATA_DIR || './data',
        server_ip: process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1',
        server_port: process.env.OPENSHIFT_NODEJS_PORT || 8080,
        server_db: (process.env.MONGODB_URL || process.env.OPENSHIFT_MONGODB_DB_URL || 'mongodb://127.0.0.1:27017/')
            + (process.env.OPENSHIFT_APP_NAME || 'test'),
    };
    globals.server_hostname = process.env.NODEJS_SERVER_HOSTNAME || process.env.OPENSHIFT_APP_DNS || ('localhost:' + globals.server_port)

    var files = [];
    try {
        for (var file of options[''] || []){
            files.push(JSON.parse(fs.readFileSync(file)));
        }
    } catch (e) {
        console.log(e.message);
    } delete options[''];

    return Object.freeze(extend(true, {globals}, ...files, options));
}
