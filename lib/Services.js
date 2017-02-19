'use strict';
const extend = require('extend');
const fs = require('fs');

module.exports = (options, cb) => {
    var services = {
        discord: new (require('discordie'))(),
        express: require('express')(),
        events: new (require('events'))()
    }

    services.discord.autoReconnect.enable();
    services.express.set('view engine', 'ejs');
    services.express.get('/', (req, res) => { res.render('index',{}) });

    for (let moduleFile of fs.readdirSync('./lib/Module')) {
        new (require('./Module/' + moduleFile))(services, extend(true, {}, options.globals, options[moduleFile.toLowerCase().split('.')[0]]));
    }

    return Promise.all([
        new Promise((resolve) => {
            services.discord.Dispatcher.on('GATEWAY_READY', resolve);
            services.discord.connect({token: options.auth.token});
        }),
        new Promise((resolve) => {
            services.express.listen(parseInt(options.globals.server_port), options.globals.server_ip, resolve);
        })
    ]).then(() => {
        console.log('%s: All services started.', Date(Date.now()));
        if (cb) cb(services);
        return services;
    });
}
