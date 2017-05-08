'use strict';
const cheerio = require('cheerio');
const request = require('request');
const url = require('url');

function breakquery(query) {
    var values = {}
    var matches = query.match(/[^=&]+=[^&]*/g);
    for (var i = 0; i < matches.length; i++) {
        matches[i] = matches[i].split('=');
        values[matches[i][0]] = matches[i][1];
    }
    return values;
}

module.exports =
/**
 * Fixes sent embed from [Pixiv]{@link http://www.pixiv.net} website.
 *
 * @constructor Module.Pixiv
 * @param {ServiceGroup} services - Service instances
 * @param {Object} options - Module options
 * @param {string[]} options.channels - Array of channel ids where this module should be active
 * @param {string} options.auth - Authentication cookies to be used while reading the website
 */
class Pixiv {
    constructor(services, options) {
        this.channels = options && options.channels || [];
        this.auth = options && options.auth || '';
        this.events = services.events;

        services.events.on('domain.www.pixiv.net', this.onDomain, this);
    }

    /**
     * Handle domain events for [Pixiv]{@link http://www.pixiv.net}
     * @method Module.Pixiv#onDomain
     * @listens Event#event:"domain.&lt;domainHostname&gt;"
     */
    onDomain(message, url) {
        if (this.channels.indexOf(message.channel.id) == -1) return; //Drop

        let embedMessage = (embed) => {
            let author = message.author;
            message.delete();
            message.channel.sendTyping();
            var file = embed.file;
            if (embed.file) delete embed.file;
            message.channel.createMessage({content: message.content, embed}, file).then(message => {
                this.events.emit("ownership", message.id, author.id);
            });
            console.log('Embed: ' + url.href);
        }

        if (url.pathname == '/member_illust.php') {
            message.channel.sendTyping();
            let query = breakquery(url.query);
            if (query.mode && query.mode == 'manga') {
                this.fetchMangaEmbed(message.member, url.href)
                    .then(embedMessage);
            } else {
                this.fetchImageEmbed(message.member, url.href)
                    .then(embedMessage);
            }
        }
    }

    /**
     * Retrieve a embed object for an artwork from the website
     * @method Module.Pixiv#fetchImageEmbed
     * @param author - Discord guild member object. See {@link https://abal.moe/Eris/docs/GuildMember}
     * @param {string} url - Artwork url.
     * @return {Promise<Object>}
     */
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

    /**
     * Retrieve a embed object for a manga volume from the website
     * @method Module.Pixiv#fetchMangaEmbed
     * @param author - Discord guild member object. See {@link https://abal.moe/Eris/docs/GuildMember}
     * @param {string} url - Artwork url.
     * @return {Promise<Object>}
     */
    fetchMangaEmbed(author, url) {
        return new Promise((resolve, reject) => {
            request({url, headers: {Cookie: this.auth}}, (e, response, body) => {
                if (e) return reject(e);
                if (response.statusCode != 200) return reject(response.statusMessage);

                body = cheerio.load(body);
                request({
                    url: body('.item-container img').first().attr('data-src'),
                    headers: {"Referer": "http://www.pixiv.net/member_illust.php", "Cookie": this.auth},
                    encoding: null
                }, (e, r, buffer) => {
                    if (e) return reject(e);
                    resolve({
                        type: 'article',
                        title: body('title').attr('content'),
                        footer: {text: body('.end-page .user').text()},
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
