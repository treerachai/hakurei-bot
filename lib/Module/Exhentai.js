'use strict';
const cheerio = require('cheerio');
const request = require('request');

module.exports =
class Exhentai {
    constructor(services, options) {
        this.discord = services.discord;
        this.channels = options && options.channels || [];
        this.auth = options && options.auth || '';

        services.events.on('domain.exhentai.org', this.onDomain, this);
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

        if (url.path.startsWith('/g/')) {
            message.channel.sendTyping();
            this.fetchComicEmbed(message.member, url.href)
                .then(embedMessage, console.log);
        } else if (url.path.startsWith('/s/')) {
            message.channel.sendTyping();
            this.fetchPageEmbed(message.member, url.href)
                .then(embedMessage, console.log);
        }
    }

    fetchPageEmbed(author, url) {
        return new Promise((resolve, reject) => {
            request({url, headers: {"Cookie": this.auth}}, (error, response, body) => {
                if (error) return reject(error);
                if (response.statusCode != 200) return reject(response.statusMessage);

                body = cheerio.load(body);
                request({url: body('#img').attr('src'), headers: {"Cookie": this.auth}, encoding:null}, (e, r, buffer) => {
                    resolve({
                        type: 'image',
                        title: body('h1').text() + body('#i2 .sn div').text(),
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
            request({url, headers: {"Cookie": this.auth}}, (error, response, body) => {
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

                request({
                    url: body('#gd1 > div').css('background').match(/url\((['"]?)(.*)\1\)/)[2],
                    headers: {"Cookie": this.auth},
                    encoding: null
                }, (e, r, buffer) => {
                    resolve({
                        type: 'article',
                        title: body('#gn').text().slice(0,255),
                        fields: fields,
                        description: 'Rating ' + body('#rating_label').text(),
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
}
