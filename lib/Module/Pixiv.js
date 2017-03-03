'use strict';
const cheerio = require('cheerio');
const request = require('request');
const url = require('url');

module.exports =
class Pixiv {
    constructor(services, options) {
        this.discord = services.discord;
        this.channels = options && options.channels || [];
        this.auth = options && options.auth || '';

        services.events.on('domain.www.pixiv.net', this.onDomain, this);
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

        if (url.pathname == '/member_illust.php') {
            message.channel.sendTyping();
            this.fetchImageEmbed(message.member, url.href)
                .then(embedMessage, console.log);
        }
    }

    fetchImageEmbed(author, url) {
        return new Promise((resolve, reject) => {
            request({url, headers: {Cookie: this.auth}}, (e, response, body) => {
                if (e) return reject(e);
                if (response.statusCode != 200) return reject(response.statusMessage);

                body = cheerio.load(body);
                request({
                    url: body('._layout-thumbnail img').attr('src'),
                    headers: {"Referer": "http://www.pixiv.net/member_illust.php", "Cookie": this.auth},
                    encoding: null
                }, (e, r, buffer) => {
                    if (e) return reject(e);
                    resolve({
                        type: 'article',
                        title: body('meta[property="og:title"]').attr('content'),
                        footer: {text: body('.user-link .user').text()},
                        description: body('meta[property="og:description"]').attr('content'),
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
