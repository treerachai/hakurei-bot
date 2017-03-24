'use strict';
const isUrl =  /^(?:\w+:)?\/\/([^\s\.]+\.\S{2})\S*$/;

/**
 * Notify when a link or a embed with hostname `domainHostname` is sent.
 *
 * @memberof Events
 * @event "domain.&lt;domainHostname&gt;"
 * @param message - Discord Message Object. See {@link https://abal.moe/Eris/docs/Message}
 * @param url - Url object. See {@link https://nodejs.org/api/url.html}
 */

module.exports =
/**
 * Module that manages messages with links or embeds
 *
 * @constructor Internal.Domain
 * @param {ServiceGroup} services - Service instances
 * @param {Object} options - Module options
 * @fires Event#event:"domain.&lt;domainHostname&gt;"
 */
class Domain {
    constructor(services, options) {
        this.discord = services.discord;
        this.events = services.events;
        this.loaded = {};

        this.discord.on('messageCreate', this.onMessage, this);
        this.discord.on('messageUpdate', this.onMessageUpdate, this);
    }

    /**
     * Handle Discord Message Update Event
     * @method Internal.Domain#onMessageUpdate
     * @see https://abal.moe/Eris/docs/Client#event-messageUpdate
     */
    onMessageUpdate(message, old) {
        if (old.hasOwnProperty('content')) this.onMessage(message);
    }

    /**
     * Handle Discord Message Create Event
     * @method Internal.Domain#onMessage
     * @see https://abal.moe/Eris/docs/Client#event-messageCreate
     */
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
