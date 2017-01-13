"use strict";
const express = require('express');
const options = require('./Options')();
const url = require('url');
const Request = require('request');
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
        server.get('/exhentai', (req, res) => { this.onExhentai(req, res) });

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

    onExhentai(request, response) {
        if (!request.query.url) return response.render('index',{});
        let urlObject = url.parse(request.query.url);
        if (urlObject.hostname != 'exhentai.org') return response.render('index',{});
        Request({
            url: request.query.url,
            headers: {
                "Cookie": options.exhentai.auth,
            }
        }).pipe(response);
    }
}
