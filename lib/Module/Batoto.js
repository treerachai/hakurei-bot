'use strict';
const cheerio = require('cheerio');
const request = require('request').defaults();
const url = require('url');
const options = require('../Options.js')();

module.exports =
class Batoto {
    constructor(client) {
        this.client = client;
        this.loading = {};
        client.Dispatcher.on('MESSAGE_CREATE', (e) => { this.onMessage(e); });
        client.Dispatcher.on('MESSAGE_UPDATE', (e) => { this.onMessage(e); });
    }

    onMessage(event) {
        if (event.message.author.id == this.client.User.id) return; // Drop
        if (options.batoto.channels.indexOf(event.message.channel.id) == -1) return; //Drop
        if (this.loading[event.message.id]) return; // Drop

        for (let embed of event.message.embeds) {
            this.loading[event.message.id] = true;
            let urlObject = url.parse(embed.url);
            if (urlObject.hostname == 'bato.to') {
                if (urlObject.path == '/reader') {
                    let hash = urlObject.hash.slice(1).split('_');
                    request({
                        url: 'http://bato.to/areader?id=' + hash[0] + '&p=' + (hash[1] ? hash[1] : 1),
                        headers: {
                            "Referer": "http://bato.to/reader",
                            "Cookie": options.batoto.auth,
                            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:50.0) Gecko/20100101 Firefox/50.0",
                        }
                    }, (error, response, body) => {
                        if (response.statusCode == 200) {
                            body = cheerio.load(body);
                            event.message.channel.sendMessage(event.message.author.mention + ': ' + event.message.content, false, {
                                type: 'image',
                                url: embed.url,
                                image: { url: body('#full_image img').attr('src') },
                            }).catch(console.log);
                            event.message.delete().catch(console.log);
                            console.log('Embed: ' + body('#full_image img').attr('src'));
                        }
                    });
                } else {
                    request(embed.url, (error, response, body) => {
                        body = cheerio.load(body);
                        event.message.channel.sendMessage(event.message.author.mention + ': ' + event.message.content, false, {
                            type: embed.type,
                            title: embed.title,
                            description: embed.description,
                            url: embed.url,
                            image: { url: body('.ipsBox img').attr('src') },
                        }).catch(console.log);
                        event.message.delete().catch(console.log);
                        console.log('Embed: ' + body('.ipsBox img').attr('src'));
                    });
                }
            }
        }
    }
}
