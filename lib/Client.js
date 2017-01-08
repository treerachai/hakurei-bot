'use strict';
const Discord = require('discordie');
const options = require('./Options.js')();
const fs = require('fs');

module.exports =
class Client {
    constructor(token) {
        this._client = new Discord();

        for (let moduleFile of fs.readdirSync('./lib/Module')) {
            new (require('./Module/' + moduleFile))(this._client);
        }

        this._client.connect({token: options.auth.token});
    }
}
