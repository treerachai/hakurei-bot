'use strict';
const options = require('./Options.js')();
const fs = require('fs');

module.exports = (cb) => {
    var client = new (require('discordie'))();
    var server = require('express')();
    var events = new (require('events'))();

    client.autoReconnect.enable();
    server.set('view engine', 'ejs');
    server.get('/', (req, res) => { res.render('index',{}) });

    for (let moduleFile of fs.readdirSync('./lib/Module')) {
        new (require('./Module/' + moduleFile))(client, server, events);
    }

    return Promise.all([
        new Promise((resolve) => {
            client.Dispatcher.on('GATEWAY_READY', resolve);
            client.connect({token: options.auth.token});
        }),
        new Promise((resolve) => {
            server.listen(parseInt(options.server.port), options.server.ip, resolve);
        })
    ]).then(() => {
        console.log('%s: All services started.', Date(Date.now()));
        if (cb) cb({client, server, events});
        return {client, server, events};
    });
}
