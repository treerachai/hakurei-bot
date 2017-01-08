"use strict";
var express = require('express');
var options = require('./Options')();

module.exports =
class Server {
    constructor() {
        var server = express();
        server.set('view engine', 'ejs');

        server.get('/', (req, res) => { this.onIndex(req, res) });

        server.listen(parseInt(options.server.port), options.server.ip, () => {
            console.log('%s: Node server started.', Date(Date.now()));
        });
    }

    onIndex(request, response) {
        response.render('index',{});
    }
}
