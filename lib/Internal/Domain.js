'use strict';
const isUrl =  /^(?:\w+:)?\/\/([^\s\.]+\.\S{2})\S*$/;

module.exports =
class Media {
    constructor(services, options) {
        this.discord = services.discord;
        this.events = services.events;
        this.loaded = {};

        this.discord.on('messageCreate', this.onMessage, this);
        this.discord.on('messageUpdate', this.onMessageUpdate, this);
    }

    onMessageUpdate(message, old) {
        if (old.hasOwnProperty('content')) this.onMessage(message);
    }

    onMessage(message) {
        if (message.author.id == this.discord.user.id) return; // Drop
        let urls = [];

        if (isUrl.test(message.content)) urls.push(message.content);
        for (let embed of message.embeds) {
            if (embed.url) urls.push(embed.url);
        }
        for (let attachment of message.attachments) {
            urls.push(attachment.url);
        }

        for (let url of urls) {
            if (!this.loaded[url]) try {
                this.loaded[url] = true;
                url = require('url').parse(url);
                this.events.emit('domain.' + url.hostname, message, url);
            } catch (err) {}
        }
    }
}
