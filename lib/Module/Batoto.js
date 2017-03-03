'use strict';
const cheerio = require('cheerio');
const request = require('request');
const mime = require('mime');

module.exports =
class Batoto {
    constructor(services, options) {
        this.discord = services.discord;
        this.channels = options && options.channels || [];
        this.auth = options && options.auth || '';

        services.events.on('domain.bato.to', this.onDomain, this);
    }

    onDomain(message, url) {
        if (this.channels.indexOf(message.channel.id) == -1) return; //Drop

        function embedMessage(embed) {
            message.delete();
            message.channel.sendTyping();
            var file = embed.file;
            if (embed.file) delete embed.file;
            message.channel.createMessage({content: message.content, embed}, file).catch(console.log);
            console.log('Embed: ' + url.href);
        }

        if (url.path == '/reader') {
            let hash = url.hash.slice(1).split('_');
            message.channel.sendTyping();
            this.fetchPageEmbed(message.member, hash[0], hash[1])
                .then(embedMessage, console.log);
        } else if (url.path.startsWith('/comic/_/comics') || url.path.startsWith('/sp/')){
            message.channel.sendTyping();
            this.fetchComicEmbed(message.member, url.href)
                .then(embedMessage, console.log);
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
            }, (e, response, body) => {
                if (e) return reject(e);
                if (response.statusCode != 200) return reject(response.statusMessage);

                body = cheerio.load(body);
                request(body('#full_image img').attr('src'), {encoding: null}, (e, r, buffer) => {
                    if (e) return reject(e);
                    resolve({
                        type: 'image',
                        title: body('#comic_page').attr('alt'),
                        image: {url: 'attachment://file.png'},
                        file: {file: buffer, name: 'file.png'},
                        author: {
                            name: author.nick || author.username,
                            icon_url: author.avatarURL,
                        }
                    });
                });
            });
        });
    }

    fetchComicEmbed(author, url) {
        return new Promise((resolve, reject) => {
            request(url, (e, response, body) => {
                if (e) return reject(e);
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
                        name: author.nick || author.username,
                        icon_url: author.avatarURL,
                    },
                    image: { url: body('.ipsBox img').attr('src') },
                });
            });
        });
    }
}
