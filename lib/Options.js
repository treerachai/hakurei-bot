'use strict';
const extend = require('extend');
const fs = require('fs');

var options;

module.exports =
function(customs) {
    if (options) return options;
    if (!customs) customs = {};

    var globals = {
        data_dir: process.env.NODEJS_DATA_DIR || process.env.OPENSHIFT_DATA_DIR || './data',
        server_ip: process.env.NODEJS_SERVER_IP || process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1',
        server_port: process.env.NODEJS_SERVER_PORT || process.env.OPENSHIFT_NODEJS_PORT || 8080,
        server_db: process.env.NODEJS_SERVER_DB_URL || process.env.OPENSHIFT_MONGODB_DB_URL || 'mongodb://127.0.0.1:27017/test',
    };
    globals.server_hostname = process.env.NODEJS_SERVER_HOSTNAME || process.env.OPENSHIFT_APP_DNS || ('localhost:' + globals.server_port)

    var files = [];
    try {
        for (var file of customs[''] || []){
            files.push(JSON.parse(fs.readFileSync(file)));
        }
    } catch (e) {
        console.log(e.message);
    } delete customs[''];

    return options = Object.freeze(extend(true, {globals}, ...files, customs));
}
