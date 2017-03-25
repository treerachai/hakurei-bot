'use strict';
const extend = require('extend');

/** @namespace Internal */
/** @namespace Module */
/**
 * Event emitter for intermodule comunication. See {@link https://nodejs.org/api/events.html}
 * @class Events
 * @abstract
 */

/**
 * Group of Service Instances
 *
 * @typedef ServiceGroup
 * @property discord - Discord client instance. See {@link https://abal.moe/Eris/docs/Client}
 * @property express - Express application instance. See {@link http://expressjs.com/en/4x/api.html#app}
 * @property {MongoConnectService} mongoConnect - Mongo connection handler.
 * @property {Events} events - Event emitter for intermodule communication.
 */

/**
 * Services Loader Function.
 *
 * @function Services
 * @param {Object} options - Application and Modules options. See {@link Options}
 * @param {function(ServiceGroup)} [cb] - Callback called after all services are ready.
 * @return {Promise<ServiceGroup>} promise
 */
module.exports = (options, cb) => {
    var services = {
        discord: new (require('eris'))(options.auth.token),
        express: require('express')(),
        mongoConnect: require('./MongoConnect')(options.globals.server_db, 90000),
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
