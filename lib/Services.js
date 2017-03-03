'use strict';
const extend = require('extend');

module.exports = (options, cb) => {
    var services = {
        discord: new (require('eris'))(options.auth.token),
        express: require('express')(),
        events: new (require('eventemitter3'))()
    }

    services.express.set('view engine', 'ejs');
    services.express.get('/', (req, res) => { res.render('index',{}) });

    var internals = {
        command: new (require('./Internal/Command'))(services, options.command),
        domain: new (require('./Internal/Domain'))(services, options.domain)
    }

    for (let module in options.modules) {
        new (require('./Module/' + module))(services, extend(true, {}, options.globals, options.modules[module]));
    }

    return Promise.all([
        new Promise((resolve) => {
            services.discord.on('ready', resolve);
            services.discord.on('error', console.log);
            services.discord.connect();
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
