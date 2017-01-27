'use strict';
const cheerio = require('cheerio');
const request = require('request');
const url = require('url');
const options = require('../Options.js')();

module.exports =
class Pixiv {
    constructor(client, server) {
        this.client = client;
        this.server = server;

        client.Dispatcher.on('MESSAGE_CREATE', (e) => { this.onMessage(e); });
        server.get('/pixiv', (req, res) => { this.onServerRequest(req, res) });
    }

    onServerRequest(req, res) {
        if (!req.query.url) return res.render('index',{});
        let urlObject = url.parse(req.query.url);
        if (!urlObject.hostname.match(/i\d+\.pixiv\.net/)) return res.render('index',{});
        request({
            url: req.query.url,
            headers: {
                "Referer": "http://www.pixiv.net/member_illust.php",
                "Cookie": options.pixiv.auth,
            }
        }).pipe(res);
    }

    onMessage(event) {
        if (event.message.author.id == this.client.User.id) return; // Drop
        if (options.pixiv.channels.indexOf(event.message.channel.id) == -1) return; //Drop

        function embedMessage(embed) {
            event.message.channel.sendMessage(event.message.content, false, embed).catch(console.log);
            event.message.delete().catch(console.log);
            console.log('Embed: ' + embed.image.url);
        }

        if (event.message.content.startsWith('http://www.pixiv.net')) {
            let urlObject = url.parse(event.message.content.split(' ', 1)[0]);
            if (urlObject.pathname == '/member_illust.php') {
                this.fetchImageEmbed(event.message.author, urlObject.href)
                    .then(embedMessage, console.log);
            }
        }
    }

    fetchImageEmbed(author, url) {
        return new Promise((resolve, reject) => {
            request({
                url: url,
                headers: {
                    Cookie: options.pixiv.auth
                }
            }, (error, response, body) => {
                if (error) return reject(error);
                if (response.statusCode != 200) return reject(response.statusMessage);

                body = cheerio.load(body);
                resolve({
                    type: 'article',
                    title: body('meta[property="og:title"]').attr('content'),
                    footer: {text: body('.user-link .user').text()},
                    description: body('meta[property="og:description"]').attr('content'),
                    author: {
                        name: author.name || author.username,
                        icon_url: author.avatarURL,
                    },
                    image: {url: 'http://' + options.server.hostname + '/pixiv?url=' + body('._layout-thumbnail img').attr('src')}
                });
            });
        });
    }
}
