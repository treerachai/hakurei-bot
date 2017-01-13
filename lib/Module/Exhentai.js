'use strict';
const cheerio = require('cheerio');
const request = require('request');
const url = require('url');
const options = require('../Options.js')();

module.exports =
class Exhentai {
    constructor(client) {
        this.client = client;
        this.loading = {};
        client.Dispatcher.on('MESSAGE_CREATE', (e) => { this.onMessage(e); });
        client.Dispatcher.on('MESSAGE_UPDATE', (e) => { this.onMessage(e); });
    }

    onMessage(event) {
        if (!event.message) return; // Drop
        if (event.message.author.id == this.client.User.id) return; // Drop
        if (options.exhentai.channels.indexOf(event.message.channel.id) == -1) return; //Drop
        if (this.loading[event.message.id]) return; // Drop

        for (let embed of event.message.embeds) {
            this.loading[event.message.id] = true;
            let urlObject = url.parse(embed.url);
            if (urlObject.hostname == 'exhentai.org') {
                if (urlObject.path.startsWith('/g/')) {
                    request({
                        url: embed.url,
                        headers: {
                            "Cookie": options.exhentai.auth,
                        }
                    }, (error, response, body) => {
                        if (response.statusCode == 200) {
                            body = cheerio.load(body);
                            event.message.channel.sendMessage(event.message.content, false, {
                                type: 'article',
                                title: body('#gn').text(),
                                fields: this.buildDescription(body),
                                description: 'Rating ' + body('#rating_label').text(),
                                author: {
                                    name: event.message.author.name || event.message.author.username,
                                    icon_url: event.message.author.avatarURL,
                                },
                                image: { url: 'http://' + options.server.hostname + '/exhentai?url=' + body('#gd1 img').attr('src') }
                            }).catch(console.log);
                            event.message.delete().catch(console.log);
                            console.log('Embed: ' + 'http://' + options.server.hostname + '/exhentai?url=' + body('#gd1 img').attr('src'));
                        } else {
                            console.log(error, response && response.statusCode);
                        }
                    });
                } else if (urlObject.path.startsWith('/s/')) {
                    request({
                        url: embed.url,
                        headers: {
                            "Cookie": options.exhentai.auth,
                        }
                    }, (error, response, body) => {
                        if (response.statusCode == 200) {
                            body = cheerio.load(body);
                            event.message.channel.sendMessage(event.message.content, false, {
                                type: 'image',
                                title: body('h1').text() + body('#i2 .sn div').text(),
                                image: { url: body('#img').attr('src') },
                                author: {
                                    name: event.message.author.name || event.message.author.username,
                                    icon_url: event.message.author.avatarURL,
                                }
                            }).catch(console.log);
                            event.message.delete().catch(console.log);
                            console.log('Embed: ' + body('#img').attr('src'));
                        } else {
                            console.log(error, response && response.statusCode);
                        }
                    });
                }
            }
        }
    }

    buildDescription(body) {
        var description = [];
        body('#taglist table tr').each((i, e) => {
            description.push({
                name: body(e).children('.tc').text(),
                value: body(e).find('a').map((i, e) => body(e).text()).get().join(', '),
                inline: true,
            });
        });
        return description;
    }
}
