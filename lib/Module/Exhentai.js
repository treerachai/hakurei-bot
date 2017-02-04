'use strict';
const cheerio = require('cheerio');
const request = require('request');
const url = require('url');
const options = require('../Options.js')();

module.exports =
class Exhentai {
    constructor(client, server) {
        this.client = client;
        this.server = server;

        this.loading = {};
        client.Dispatcher.on('MESSAGE_CREATE', (e) => { this.onMessage(e); });
        client.Dispatcher.on('MESSAGE_UPDATE', (e) => { this.onMessage(e); });
        server.get('/exhentai', (req, res) => { this.onServerRequest(req, res) });
    }

    onMessage(event) {
        if (!event.message) return; // Drop
        if (event.message.author.id == this.client.User.id) return; // Drop
        if (options.exhentai.channels.indexOf(event.message.channel.id) == -1) return; //Drop
        if (this.loading[event.message.id]) return; // Drop

        function embedMessage(embed) {
            event.message.channel.sendMessage(event.message.content, false, embed).catch(console.log);
            event.message.delete().catch(console.log);
            console.log('Embed: ' + embed.image.url);
        }

        for (let embed of event.message.embeds) if (embed.url) {
            this.loading[event.message.id] = true;
            let urlObject = url.parse(embed.url);
            if (urlObject.hostname == 'exhentai.org') {
                if (urlObject.path.startsWith('/g/')) {
                    this.fetchComicEmbed(event.message.author, embed.url)
                        .then(embedMessage, console.log);
                } else if (urlObject.path.startsWith('/s/')) {
                    this.fetchPageEmbed(event.message.author, embed.url)
                        .then(embedMessage, console.log);
                }
            }
        }
    }

    onServerRequest(req, res) {
        if (!req.query.url) return res.render('index',{});
        let urlObject = url.parse(req.query.url);
        if (urlObject.hostname != 'exhentai.org') return res.render('index',{});
        request({
            url: req.query.url,
            headers: {
                "Cookie": options.exhentai.auth,
            }
        }).pipe(res);
    }

    fetchPageEmbed(author, url) {
        return new Promise((resolve, reject) => {
            request({
                url: url,
                headers: {
                    "Cookie": options.exhentai.auth,
                }
            }, (error, response, body) => {
                if (error) return reject(error);
                if (response.statusCode != 200) return reject(response.statusMessage);

                body = cheerio.load(body);
                resolve({
                    type: 'image',
                    title: body('h1').text() + body('#i2 .sn div').text(),
                    image: { url: body('#img').attr('src') },
                    author: {
                        name: author.name || author.username,
                        icon_url: author.avatarURL,
                    }
                });
            });
        });
    }

    fetchComicEmbed(author, url) {
        return new Promise((resolve, reject) => {
            request({
                url: url,
                headers: {
                    "Cookie": options.exhentai.auth,
                }
            }, (error, response, body) => {
                if (error) return reject(error);
                if (response.statusCode != 200) return reject(response.statusMessage);

                body = cheerio.load(body);
                let fields = [];
                body('#taglist table tr').each((i, e) => {
                    fields.push({
                        name: body(e).children('.tc').text(),
                        value: body(e).find('a').map((i, e) => body(e).text()).get().join(', '),
                        inline: true,
                    });
                });

                resolve({
                    type: 'article',
                    title: body('#gn').text(),
                    fields: fields,
                    description: 'Rating ' + body('#rating_label').text(),
                    author: {
                        name: author.name || author.username,
                        icon_url: author.avatarURL,
                    },
                    image: { url: 'http://' + options.server.hostname + '/exhentai?url=' + body('#gd1 img').attr('src') }
                });
            });
        });
    }
}
