"use strict";
var express = require('express');
var options = require('./Options')();
const Google = require('./Util/Google');

module.exports =
class Server {
    constructor() {
        if (!Google.loadCredentials()){
            console.log('Credentials Couldn\'t be loaded. Access the following link to reset Credentials');
            console.log(Google.generateAuthUrl());
        }

        var server = express();
        server.set('view engine', 'ejs');
        server.get('/', (req, res) => { this.onIndex(req, res) });
        server.get(options.google.redirectPath, (req, res) => { this.onGoogleRedirect(req, res) });

        server.listen(parseInt(options.server.port), options.server.ip, () => {
            console.log('%s: Node server started.', Date(Date.now()));
        });
    }

    onIndex(request, response) {
        response.render('index',{});
    }

    onGoogleRedirect(request, response) {
        var successful = false;
        Google.getCredentials(request.query.code).then(() => {
            console.log('Google credentials renewed.');
        }, (err) => {
            console.log(err);
        })
        response.render('googleRedirect',{});
    }
}
