'use strict';
const cheerio = require('cheerio');
const request = require('request');

module.exports =
/**
 * Fixes sent embed from [Batoto]{@link http://bato.to} website.
 *
 * @constructor Module.Batoto
 * @param {ServiceGroup} services - Service instances
 * @param {Object} options - Module options
 * @param {string[]} options.channels - Array of channel ids where this module should be active
 * @param {string} options.auth - Authentication cookies to be used while reading the website
 */
class Batoto {
    constructor(services, options) {
        this.channels = options && options.channels || [];
        this.auth = options && options.auth || '';

        services.events.on('domain.bato.to', this.onDomain, this);
    }

    /**
     * Handle domain events for [Batoto]{@link http://bato.to}
     * @method Module.Batoto#onDomain
     * @listens Event#event:"domain.&lt;domainHostname&gt;"
     */
    onDomain(message, url) {
        if (this.channels.indexOf(message.channel.id) == -1) return; //Drop

        function embedMessage(embed) {
            message.delete();
            message.channel.sendTyping();
            var file = embed.file;
            if (embed.file) delete embed.file;
            message.channel.createMessage({content: message.content, embed}, file);
            console.log('Embed: ' + url.href);
        }

        if (url.path == '/reader') {
            let hash = url.hash.slice(1).split('_');
            message.channel.sendTyping();
            this.fetchPageEmbed(message.member, hash[0], hash[1])
                .then(embedMessage);
        } else if (url.path.startsWith('/comic/_/comics') || url.path.startsWith('/sp/')){
            message.channel.sendTyping();
            this.fetchComicEmbed(message.member, url.href)
                .then(embedMessage);
        }
    }

    /**
     * Retrieve a embed object for a comic page from the website
     *
     * @method Module.Batoto#fetchPageEmbed
     * @param author - Discord guild member object. See {@link https://abal.moe/Eris/docs/GuildMember}
     * @param {string} id - Reader comic id hash.
     * @param {number} page - Page number.
     * @return {Promise<Object>}
     */
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

    /**
     * Retrieve a embed object for a comic info from the website
     *
     * @method Module.Batoto#fetchComicEmbed
     * @param author - Discord guild member object. See {@link https://abal.moe/Eris/docs/GuildMember}
     * @param {string} url - Comic url.
     * @return {Promise<Object>}
     */
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
