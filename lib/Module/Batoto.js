'use strict';
const cheerio = require('cheerio');
const request = require('request').defaults({jar:true});
const url = require('url');
const options = require('../Options.js')();

module.exports =
class Batoto {
    constructor(client) {
        this.client = client;
        //this.client.on('message', (m) => { this.onMessage(m); });
    }

    onMessage(message) {
        if (message.author.id == this.client.user.id) return; // Drop

        for (let embed of message.embeds) {
            let urlObject = url.parse(embed.url);
            if (urlObject.hostname == 'bato.to') {
                if (urlObject.path == '/reader') {
                    let hash = urlObject.hash.slice(1).split('_');
                    request({
                        url: 'http://bato.to/areader?id=' + hash[0] + '&p=' + (hash[1] ? hash[1] : 1),
                        headers: { "Referer": "http://bato.to/reader" }
                    }, (error, response, body) => {
                        if (response.statusCode == 200) {
                            body = cheerio.load(body);
                            message.channel.send(message.author + ': ' + message.content, {
                                embed: {
                                    type: 'image',
                                    url: embed.url,
                                    image: { url: body('#full_image img').attr('src') },
                                }
                            }).catch(console.log);
                            message.delete().catch(console.log);
                            console.log('Embed: ' + body('#full_image img').attr('src'));
                        }
                    });
                } else {
                    request(embed.url, (error, response, body) => {
                        body = cheerio.load(body);
                        message.channel.send(message.author + ': ' + message.content, {
                            embed: {
                                type: embed.type,
                                title: embed.title,
                                description: embed.description,
                                url: embed.url,
                                image: { url: body('.ipsBox img').attr('src') },
                            }
                        }).catch(console.log);
                        message.delete().catch(console.log);
                        console.log('Embed: ' + body('.ipsBox img').attr('src'));
                    });
                }
            }
        }
    }
}
