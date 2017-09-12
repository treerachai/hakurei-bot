'use strict';
const fs = require('fs');

/**
 * Configuration Loader Function
 *
 * @function Options
 * @param {Object} options - Options values to be loaded.
 * @param {string[]} options."" - List of json files to load options from (low priority).
 * @param {string} options.discord.token - Discord authentication token.
 * @param {string} options.discord.owner - Discord user id to grant full control.
 * @param {string} options.express.ip - Ip to bind the express server
 * @param {string} options.express.port - Port to bind the express server
 * @param {string} options.express.host - External express hostname
 * @param {string} options.mongo.url - Mongo database connection url
 * @return {Object} options - Merged options values.
 */
module.exports = (options) => {
    options = options || {};

    options.express = options.express || {};
    options.express.ip = options.express.ip || process.env.IP || process.env.OPENSHIFT_NODEJS_IP || '0.0.0.0';
    options.express.port = options.express.port || process.env.PORT || process.env.OPENSHIFT_NODEJS_PORT || 8080;
    options.express.host = options.express.host || process.env.HOST || process.env.OPENSHIFT_NODEJS_HOST || 'http://localhost';

    options.mongo = options.mongo || {};
    options.mongo.url = options.mongo.url || process.env.MONGO_URL || process.env.OPENSHIFT_MONGODB_DB_URL;
    if (!options.mongo.url && process.env.DATABASE_SERVICE_NAME) {
        options.mongo.url = 'mongodb://'
            + process.env.MONGODB_USER + ':' + process.env.MONGODB_PASSWORD + '@'
            + process.env.MONGODB_SERVICE_HOST + ':' + process.env.MONGODB_SERVICE_PORT + '/'
            + process.env.MONGODB_DATABASE;
    } if (!options.mongo.url) options.mongo.url = 'mongodb://127.0.0.1:27017/';

    options.discord = options.discord || {};
    options.discord.token = options.discord.token || process.env.DISCORD_TOKEN;
    options.discord.owner = options.discord.owner || process.env.DISCORD_OWNER;

    // TODO options files loading
//    var files = [];
//    try {
//        for (var file of options[''] || []){
//            files.push(JSON.parse(fs.readFileSync(file)));
//        }
//    } catch (e) {
//        console.log(e.message);
//    } delete options[''];

    return options;
}
