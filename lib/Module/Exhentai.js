'use strict';
const cheerio = require('cheerio');
const request = require('request');

module.exports =
/**
 * Fixes sent embed from [Exhentai]{@link http://exhentai.org} website.
 *
 * @constructor Module.Exhentai
 * @param {ServiceGroup} services - Service instances
 * @param {Object} options - Module options
 * @param {string[]} options.channels - Array of channel ids where this module should be active
 * @param {string} options.auth - Authentication cookies to be used while reading the website
 */
class Exhentai {
    constructor(services, options) {
        this.channels = options && options.channels || [];
        this.auth = options && options.auth || '';

        services.events.on('domain.exhentai.org', this.onDomain, this);
    }

    /**
     * Handle domain events for [Exhentai]{@link http://exhentai.org}
     * @method Module.Exhentai#onDomain
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

        if (url.path.startsWith('/g/')) {
            message.channel.sendTyping();
            this.fetchComicEmbed(message.member, url.href)
                .then(embedMessage);
        } else if (url.path.startsWith('/s/')) {
            message.channel.sendTyping();
            this.fetchPageEmbed(message.member, url.href)
                .then(embedMessage);
        }
    }

    /**
     * Retrieve a embed object for a comic page from the website
     *
     * @method Module.Exhentai#fetchPageEmbed
     * @param author - Discord guild member object. See {@link https://abal.moe/Eris/docs/GuildMember}
     * @param {string} url - Page url.
     * @return {Promise<Object>}
     */
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

    /**
     * Retrieve a embed object for a comic info from the website
     *
     * @method Module.Exhentai#fetchComicEmbed
     * @param author - Discord guild member object. See {@link https://abal.moe/Eris/docs/GuildMember}
     * @param {string} url - Comic url.
     * @return {Promise<Object>}
     */
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
