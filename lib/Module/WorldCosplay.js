'use strict';
const cheerio = require('cheerio');
const request = require('request');

module.exports =
/**
 * Fixes sent embed from [WorldCosplay]{@link http://worldcosplay.net} website.
 *
 * @constructor Module.WorldCosplay
 * @param {ServiceGroup} services - Service instances
 * @param {Object} options - Module options
 * @param {string[]} options.channels - Array of channel ids where this module should be active
 */
class WorldCosplay {
    constructor(services, options) {
        this.channels = options && options.channels || [];

        services.events.on('domain.worldcosplay.net', this.onDomain, this);
    }

    /**
     * Handle domain events for [WorldCosplay]{@link http://worldcosplay.net}
     * @method Module.WorldCosplay#onDomain
     * @listens Event#event:"domain.&lt;domainHostname&gt;"
     */
    onDomain(message, url) {
        if (this.channels.indexOf(message.channel.id) == -1) return; //Drop

        function embedMessage(embed) {
            message.delete();
            message.channel.createMessage({content: message.content, embed}).catch(console.log);
            console.log('Embed: ' + url.href);
        }

        if (url.path.startsWith('/photo/')) {
            message.channel.sendTyping();
            this.fetchImageEmbed(message.member, url.href)
                .then(embedMessage, console.log);
        }
    }

    /**
     * Retrieve a embed object for a photo from the website
     *
     * @method Module.WorldCosplay#fetchImageEmbed
     * @param author - Discord guild member object. See {@link https://abal.moe/Eris/docs/GuildMember}
     * @param {string} url - Photo url.
     * @return {Promise<Object>}
     */
    fetchImageEmbed(author, url) {
        return new Promise((resolve, reject) => {
            request(url, (e, response, body) => {
                if (e) return reject(e);
                if (response.statusCode != 200) return reject(response.statusMessage);

                body = cheerio.load(body);
                resolve({
                    type: 'image',
                    title: body('.character_info').text(),
                    author: {
                        name: author.nick || author.username,
                        icon_url: author.avatarURL,
                    },
                    image: { url: body('#photoContainer img').attr('src') },
                });
            });
        });
    }
}
