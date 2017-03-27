'use strict';
const cheerio = require('cheerio');
const request = require('request');

/**
 * Channel specific options
 *
 * @memberof Module.BooruTags
 * @typedef ChannelOptions
 * @property {number} parseMessageCount - Number of previous messages to lookup when the module is loaded.
 * @property {string} emojiName - Reaction emoji name to count up.
 * @property {number} minPosted - How many posts a tag must have be become valid.
 * @property {number} sampleSize - How many messages are keep in database on cleanup.
 * @property {number} limit - How many tags are showed.
 */

module.exports =
/**
 * Module to pin images with many of a reaction accumulated.
 *
 * @constructor Module.BooruTags
 * @param {ServiceGroup} services - Service instances
 * @param {Object} options - Module options
 * @param {Object<string, Module.BooruTags.ChannelOptions>} options.channels - Channels options where this module is active keyed by channel id.
 * @param {number} cleanInterval - How many seconds to cleanup old messages.
 */
class BooruTags {
    constructor(services, options) {
        this.discord = services.discord;
        this.mongo = services.mongoConnect;
        this.options = options && options.channels || {};
        this.cleanInterval = (options && options.cleanInterval || 8640) * 1000;
        this.messageStack = [];
        this.commands = {};

        services.discord.on('ready', this.onReady, this);
        services.discord.on('messageReactionAdd', this.onReaction, this);
        services.discord.on('messageReactionRemove', this.onReaction, this);
        services.events.on('command.boorutags', this.onCommand, this);
        services.events.on('command.boorutags.delete', this.onDelete, this);

        setInterval(() => this.onCleanup(), this.cleanInterval);
    }

    /**
     * Handle Discord Ready Event
     * @method Module.BooruTags#onReady
     * @see https://abal.moe/Eris/docs/Client#event-ready
     */
    onReady() {
        for (let channelId in this.options) {
            let channel = this.discord.getChannel(channelId);
            this.parseMessages(channel, this.options[channelId].parseMessageCount);
        }
    }

    /**
     * Handle Discord Reaction Event
     * @method Module.BooruTags#onReaction
     * @see https://abal.moe/Eris/docs/Client#event-messageReactionAdd
     * @see https://abal.moe/Eris/docs/Client#event-messageReactionRemove
     */
    onReaction(message, emoji, userId) {
        if (!this.options[message.channel.id]) return; // Drop
        if (this.options[message.channel.id].emojiName != emoji.name) return; //Drop

        if (message.timestamp) {
            if (!this.isBooruMessage(message)) return; // Drop
            this.updateUserList(message);
        } else {
            message.channel.getMessage(message.id).then((message) => {
                if (!this.isBooruMessage(message)) return; // Drop
                this.updateUserList(message);
            });
        }
    }

    /**
     * Handle `boorutags` commands events
     * @method Module.BooruTags#onCommand
     * @listens Events.event:"command.&lt;commandName&gt;"
     */
    onCommand(id, message, argv) {
        if (!this.options[message.channel.id]) return; // Drop

        message.channel.sendTyping();
        let target = message.member;

        this.mongo().then(db => {
            db.collection('booruTags').aggregate([
                {$match: {channelId: message.channel.id}},
                {$unwind: '$tags'},
                {$group: {
                    _id: '$tags',
                    likes: {$sum: {$cond: [{$in: [target.id, '$users']}, 1, 0]}},
                    total: {$sum: 1},
                    image: {$last: '$image'},
                    url: {$last: '$url'}}},
                {$match: {total: {$gte: this.options[message.channel.id].minPosted}}},
                {$project: {_id: 0, tagName: '$_id', ratio: {$divide: ['$likes', '$total']}, likes: 1, image: 1, url: 1}},
                {$sort: {ratio: -1, likes: -1}},
                {$limit: this.options[message.channel.id].limit}
            ]).toArray().then((tags) => {
                if (!tags.length) return message.addReaction('\u274C');

                message.channel.createMessage({embed: {
                    color: 0xaf1820,
                    title: 'BooruTags',
                    thumbnail: {url: tags[0].image},
                    description: tags.map(e =>
                            '[' + Math.round(e.ratio*1000)/10 + '% **' + e.tagName + '**](' + e.url + ')'
                        ).join('\n'),
                    author: {
                        name: target.nick || target.username,
                        icon_url: target.avatarURL,
                    }
                }}).then((message) => {
                    this.commands[id] = message;
                }, console.log);
            });
        });
    }

    /**
     * Handle `boorutags` command delete events
     * @method Module.BooruTags#onDelete
     * @listens Events.event:"command.&lt;commandName&gt;.delete"
     */
    onDelete(id) {
        if (this.commands[id]) {
            this.commands[id].delete();
            delete this.commands[id];
        }
    }

    /**
     * Handle database cleanup in fixed intervals
     * @method Module.BooruTags#onCleanup
     */
    onCleanup() {
        for (let channelId in this.options) {
            let channel = this.discord.getChannel(channelId);
            this.mongo().then((db) => {
                db.collection('booruTags').count().then(length => {
                    if (length <= this.options[channelId].sampleSize) return;
                    return db.collection('booruTags')
                        .find({channelId})
                        .sort({timestamp: 1})
                        .limit(length - this.options[channelId].sampleSize)
                        .toArray();
                }).then((toRemove) => {
                    if (toRemove) db.collection('booruTags').remove({_id: {$in: toRemove.map(e => e._id)}});
                });
            })
        }
    }

    /**
     * Lookup old messages from a channel (recursive)
     *
     * @method Module.BooruTags#parseMessages
     * @param channel - Discord Channel Object. See {@link https://abal.moe/Eris/docs/GuildChannel}
     * @param {number} left - How many message left to parse.
     * @param {string} before - Oldest parsed message id.
     * TODO return
     */
    parseMessages(channel, left, before) {
        console.log(left);
        return channel.getMessages(Math.min(left, 100), before).then((messages) => {
            for (let i = messages.length; i > 0;) {
                if (this.isBooruMessage(messages[--i])) {
                    this.messageStack.push(messages[i]);
                }
            }

            if (messages.length == 100 && left > 100) {
                setTimeout(() => this.parseMessages(channel, left - messages.length, messages[messages.length - 1].id), 500);
            } else {
                this.loadFinish();
            }
        }, console.log);
    }

    /**
     * Retrive tag information and initialize the data.
     *
     * @method Module.BooruTags#updateTagList
     * @param db - Mongo database object. See {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Db.html}
     * @param message - Discord Message Object. See {@link https://abal.moe/Eris/docs/Message}
     */
    updateTagList(db, message) {
        return new Promise((resolve, reject) => request(message.embeds[0].url, (e, response, body) => {
            if (e) return reject(e);
            if (response.statusCode != 200) return reject(response.statusMessage);

            body = cheerio.load(body);
            body = body('#tag-list .search-tag').map((i, e) => cheerio(e).text()).get();

            db.collection('booruTags').updateOne({
                _id: message.id,
                channelId: message.channel.id
            }, {$set: {
                tags: body,
                timestamp: message.timestamp,
                image: message.embeds[0].thumbnail && message.embeds[0].thumbnail.url
                    || message.embeds[0].image && message.embeds[0].image.url,
                url: message.embeds[0].url,
            }});
        }));
    }

    /**
     * Updates user that reacted to the message
     *
     * @method Module.BooruTags#updateUserList
     * @param message - Discord Message Object. See {@link https://abal.moe/Eris/docs/Message}
     * @returns {Promise<string[]>} Users ids that react to the message
     */
    updateUserList(message) {
        return Promise.all([
            this.mongo(),
            message.getReaction(this.options[message.channel.id].emojiName)
        ]).then((argv) => {
            let [db, users] = argv;
            users = users.map(u => u.id);
            if (users.indexOf(message.member.id) == -1) {
                users.push(message.member.id);
            }

            return db.collection('booruTags').findOneAndUpdate({
                _id: message.id,
                channelId: message.channel.id
            }, {$set: {users}}, {upsert: true}).then(data => {
                if (!data.value) this.updateTagList(db, message).catch(console.log);
                return users;
            });
        });
    }

    /**
     * Is message this an acceptable message for this module.
     *
     * @method Module.BooruTags#isBooruMessage
     * @param message - Discord Message Object. See {@link https://abal.moe/Eris/docs/Message}
     * @returns {boolean}
     */
    isBooruMessage(message) {
        return message.embeds.length > 0 && message.embeds[0].url && message.embeds[0].url.startsWith('http://danbooru.donmai.us/posts/');
    }

    /**
     * Parse messages from `this.messageStack`
     *
     * @method Module.BooruTags#loadFinish
     */
    loadFinish() {
        let saveData = () => {
            console.log(this.messageStack.length);
            let message = this.messageStack.pop();

            this.updateUserList(message);

            if (this.messageStack.length) setTimeout(saveData, 500);
        }

        if (this.messageStack.length) saveData();
    }
}
