'use strict';
const cheerio = require('cheerio');
const request = require('request');
const url = require('url');
const options = require('../Options.js')();

module.exports =
class Pixiv {
    constructor(client) {
        this.client = client;
        this.loading = {};
        client.Dispatcher.on('MESSAGE_CREATE', (e) => { this.onMessage(e); });
    }

    onMessage(event) {
        if (event.message.author.id == this.client.User.id) return; // Drop
        if (options.pixiv.channels.indexOf(event.message.channel.id) == -1) return; //Drop
        if (this.loading[event.message.id]) return; // Drop

        if (event.message.content.startsWith('http://www.pixiv.net')) {
            let urlObject = url.parse(event.message.content.split(' ', 1)[0]);
            if (urlObject.pathname == '/member_illust.php') {
                request({
                    url: urlObject.href,
                    headers: {
                        Cookie: options.pixiv.auth
                    }
                }, (error, response, body) => {
                    if (response.statusCode == 200) {
                        body = cheerio.load(body);
                        event.message.channel.sendMessage(event.message.content, false, {
                            type: 'article',
                            title: body('meta[property="og:title"]').attr('content'),
                            footer: { text: body('.user-link .user').text(), icon_url: 'http://' + options.server.hostname + '/pixiv?url=' + body('.user-link .user-image').attr('src') },
                            description: body('meta[property="og:description"]').attr('content'),
                            author: {
                                name: event.message.author.name || event.message.author.username,
                                icon_url: event.message.author.avatarURL,
                            },
                            image: { url: 'http://' + options.server.hostname + '/pixiv?url=' + body('._layout-thumbnail img').attr('src') }
                        }).catch(console.log);
                        event.message.delete().catch(console.log);
                        console.log('Embed: ' + 'http://' + options.server.hostname + '/pixiv?url=' + body('._layout-thumbnail img').attr('src'));
                    } else {
                        console.log(error, response && response.statusCode);
                    }
                });
            }
        }
    }
}
