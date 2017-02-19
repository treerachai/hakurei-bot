'use strict';
const cheerio = require('cheerio');
const request = require('request');
const url = require('url');

module.exports =
class Pixiv {
    constructor(services, options) {
        this.discord = services.discord;
        this.express = services.express;
        this.channels = options && options.channels || [];
        this.auth = options && options.auth || '';
        this.server_hostname = options && options.server_hostname;

        this.discord.Dispatcher.on('MESSAGE_CREATE', (e) => { this.onMessage(e); });
        this.express.get('/pixiv', (req, res) => { this.onServerRequest(req, res) });
    }

    onServerRequest(req, res) {
        if (!req.query.url) return res.render('index',{});
        let urlObject = url.parse(req.query.url);
        if (!urlObject.hostname.match(/i\d+\.pixiv\.net/)) return res.render('index',{});
        request({
            url: req.query.url,
            headers: {
                "Referer": "http://www.pixiv.net/member_illust.php",
                "Cookie": this.auth,
            }
        }).pipe(res);
    }

    onMessage(event) {
        if (event.message.author.id == this.discord.User.id) return; // Drop
        if (this.channels.indexOf(event.message.channel.id) == -1) return; //Drop

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
                    Cookie: this.auth
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
                    image: {url: 'http://' + this.server_hostname + '/pixiv?url=' + body('._layout-thumbnail img').attr('src')}
                });
            });
        });
    }
}
