'use strict';
const cheerio = require('cheerio');
const request = require('request');
const url = require('url');

module.exports =
class Batoto {
    constructor(services, options) {
        this.discord = services.discord;
        this.channels = options && options.channels || [];
        this.auth = options && options.auth || '';

        this.loading = {};
        this.discord.Dispatcher.on('MESSAGE_CREATE', (e) => { this.onMessage(e); });
        this.discord.Dispatcher.on('MESSAGE_UPDATE', (e) => { this.onMessage(e); });
    }

    onMessage(event) {
        if (!event.message) return; // Drop
        if (event.message.author.id == this.discord.User.id) return; // Drop
        if (this.channels.indexOf(event.message.channel.id) == -1) return; //Drop
        if (this.loading[event.message.id]) return; // Drop

        function embedMessage(embed) {
            event.message.channel.sendMessage(event.message.content, false, embed).catch(console.log);
            event.message.delete().catch(console.log);
            console.log('Embed: ' + embed.image.url);
        }

        for (let embed of event.message.embeds) if (embed.url) {
            this.loading[event.message.id] = true;
            let urlObject = url.parse(embed.url);
            if (urlObject.hostname == 'bato.to') {
                if (urlObject.path == '/reader') {
                    let hash = urlObject.hash.slice(1).split('_');
                    this.fetchPageEmbed(event.message.author, hash[0], hash[1])
                        .then(embedMessage, console.log);
                } else if (urlObject.path.startsWith('/comic/_/comics')){
                    this.fetchComicEmbed(event.message.author, embed.url)
                        .then(embedMessage, console.log);
                }
            }
        }
    }

    fetchPageEmbed(author, id, page) {
        return new Promise((resolve, reject) => {
            request({
                url: 'http://bato.to/areader?id=' + id + '&p=' + (page || 1),
                headers: {
                    "Referer": "http://bato.to/reader",
                    "Cookie": this.auth,
                    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:50.0) Gecko/20100101 Firefox/50.0",
                }
            }, (error, response, body) => {
                if (error) return reject(error);
                if (response.statusCode != 200) return reject(response.statusMessage);

                body = cheerio.load(body);
                resolve({
                    type: 'image',
                    author: {
                        name: author.name || author.username,
                        icon_url: author.avatarURL,
                    },
                    title: body('#comic_page').attr('alt'),
                    image: { url: body('#full_image img').attr('src') },
                });
            });
        });
    }

    fetchComicEmbed(author, url) {
        return new Promise((resolve, reject) => {
            request(url, (error, response, body) => {
                if (error) return reject(error);
                if (response.statusCode != 200) return reject(response.statusMessage);

                body = cheerio.load(body);
                let fields = [];
                body('.ipb_table tr').slice(2, 7).each((i, e) => {
                    fields.push({
                        name: body(e).children().first().text(),
                        value: body(e).children().last().text() || 'none',
                        inline: true,
                    });
                });

                resolve({
                    type: 'article',
                    title: body('.ipsType_pagetitle').text(),
                    fields: fields,
                    author: {
                        name: author.name || author.username,
                        icon_url: author.avatarURL,
                    },
                    image: { url: body('.ipsBox img').attr('src') },
                });
            });
        });
    }
}
