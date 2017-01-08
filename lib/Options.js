'use strict';
const extend = require('extend');
const fs = require('fs');

var options;

module.exports =
function(customs) {
    if (options) return options;
    if (!customs) customs = {};

    var defaults = {
        dir: {
            data: process.env.NODEJS_DATA_DIR || process.env.OPENSHIFT_DATA_DIR || './data',
        },
        server: {
            ip: process.env.NODEJS_SERVER_IP || process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1',
            port: process.env.NODEJS_SERVER_PORT || process.env.OPENSHIFT_NODEJS_PORT || 8080,
        }
    };
    defaults.server.hostname = process.env.NODEJS_SERVER_HOSTNAME || process.env.OPENSHIFT_APP_DNS || ('localhost:' + defaults.server.port)

    var files = [];
    try {
        for (var file of customs[''] || []){
            files.push(JSON.parse(fs.readFileSync(file)));
        }
    } catch (e) {
        console.log(e.message);
    } delete customs[''];

    return options = Object.freeze(extend(true, defaults, ...files, customs));
}
