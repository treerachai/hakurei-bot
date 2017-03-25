'use strict';
const mongo = require('mongodb');

/**
 * Create or get an active mongo connection and returns its database.
 * @typedef {function} MongoConnectService
 * @returns {Promise} Promise that resolves into a database object. See {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Db.html}
 */

/**
 * Factory to create a function that manages mongo connection creation.
 *
 * @function MongoConnect
 * @param {string} databaseUrl - Mongo database url.
 * @param {number} timeout - Auto-disconnection timeout.
 * @returns {MongoConnectService}
 */
module.exports = (databaseUrl, timeout) => {
    let connection;
    let timeoutId;
    let promise;

    return () => {
        if (timeout) {
            if (timeoutId) clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {if (connection) connection.close();}, timeout);
        }

        if (connection) return Promise.resolve(connection);
        if (promise) return promise;

        return promise = mongo.connect(databaseUrl).then((conn) => {
            connection = conn;
            promise = null;

            connection.on('error', console.log);
            connection.on('timeout', console.log);
            connection.on('close', (err) => {
                if (err) console.log(err);
                connection = null;
            });

            return connection
        });
    }
}
