'use strict';
const cheerio = require('cheerio');
const request = require('request');
const mime = require('mime');

module.exports =
class WorldCosplay {
    constructor(services, options) {
        this.discord = services.discord;
        this.channels = options && options.channels || [];

        services.events.on('domain.worldcosplay.net', this.onDomain, this);
    }

    onDomain(message, url) {
        if (this.channels.indexOf(message.channel.id) == -1) return; //Drop

        function embedMessage(embed) {
            message.delete();
            message.channel.createMessage({content: message.content, embed}).catch(console.log);
            console.log('Embed: ' + url.href);
        }

        if (url.path.startsWith('/photo/')) {
            message.channel.sendTyping();
            this.fetchComicEmbed(message.member, url.href)
                .then(embedMessage, console.log);
        }
    }

    fetchComicEmbed(author, url) {
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
