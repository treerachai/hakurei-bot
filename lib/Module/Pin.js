'use strict';
const mongo = require('mongodb');

module.exports =
class Pin {
    constructor(services, options) {
        this.discord = services.discord;
        this.events = services.events;
        this.server_db = options && options.server_db;
        this.options = options && options.channels || {};
        this.pins = [];

        this.loading = {};
        this.discord.on('ready', this.onReady, this);
        this.discord.on('messageReactionAdd', this.onReaction, this);
        this.discord.on('messageCreate', this.onMessage, this);
        this.discord.on('messageUpdate', this.onMessageUpdate, this);
    }

    onMessageUpdate(message, old) {
        if (old.hasOwnProperty('content')) this.onMessage(message);
    }

    onReady() {
        for (let channelId in this.options) {
            let channel = this.discord.getChannel(channelId);
            if (channel) this.fetchPinnedMessages(channel).then(() => {
                this.parseMessages(channel, this.options[channel.id].parseMessageCount);
            });
        }
    }

    onReaction(message, emoji, userId) {
        if (!this.options[message.channel.id]) return; // Ignore not registered channels
        if (emoji.name != this.options[message.channel.id].emojiName) return; // Ignore other emojis

        if (message.reactions && message.channel) {
            let reaction = message.reactions[emoji.name];
            this.compareReactions(reaction, message.channel, message, this.pins);
        } else {
            message.channel.getMessage(message.id).then((message) => {
                let reaction = message.reactions[emoji.name];
                this.compareReactions(reaction, message.channel, message, this.pins);
            }, console.log);
        }
    }

    onMessage(message) {
        if (!this.options[message.channel.id]) return; // Drop
        if (!message.author) return; // Drop
        if (this.loading[message.id]) return; // Drop

        /*
        if (event.message.content.startsWith('!search ')) {
            mongo.connect(this.server_db, (err, db) => {
                if (err) return console.log(err);
                let message = '';
                let cursor = db.collection('pins').find({data: {$regex: event.message.content.slice(8), $options: 'i'}})
                cursor.forEach((pin) => {
                    message += '<' + pin.url + '>\n';
                }, (err) => {
                    if (err) console.log(err);
                    if (message) event.message.reply(message);
                    db.close();
                })
            });
        }
        */

        if (this.isPinnable(message)) {
            this.loading[message.id] = true;
            // TODO test another way
            if (Object.getOwnPropertyNames(message.reactions).length == 0) {
                message.addReaction(this.options[message.channel.id].emojiName);
            }
        }
    }

    parseMessages(channel, left) {
        return channel.getMessages(Math.min(left, 100), channel.messages[0]).then((messages) => {

            var oldestPin = this.getOldest(this.pins);
            if (this.pins.length < this.options[channel.id].limit ||
                messages[0].timestamp >= oldestPin.timestamp) {

                messages.forEach((message) => {
                    let reaction = message.reactions[this.options[channel.id].emojiName];

                    if (reaction) {
                        this.compareReactions(reaction, channel, message, this.pins);
                    }

                    if ((!reaction || !reaction.me) && this.isPinnable(message)) {
                        message.addReaction(this.options[channel.id].emojiName);
                    }
                });
            }

            if (messages.length == 100 && left > 100) {
                return this.parseMessages(channel, left - messages.length);
            }
        }, console.log);
    }

    fetchPinnedMessages(channel) {
        return channel.getPins().then((messages) => {
            this.pins = messages;
            while (messages.length > this.options[channel.id].limit) {
                this.unpinMessage(this.getOldest(messages), messages);
            }
        });
    }

    getOldest(messages) {
        if (!messages || messages.length == 0) return;
        return messages.reduce((older, current) => {
            return current.timestamp < older.timestamp ? current : older;
        });
    }

    compareReactions(reaction, channel, message, collection) {
        var channelOptions = this.options[channel.id];
        if (reaction.count >= channelOptions.emojiCount &&
            !collection.find((m) => { return m.id == message.id; }) &&
            this.isPinnable(message) ) {

            var oldestPin = this.getOldest(collection);
            if (oldestPin && oldestPin.timestamp >= message.timestamp) {
                return false;
            }

            if (collection.length >= channelOptions.limit) {
                this.unpinMessage(oldestPin, collection);
            }

            collection.push(message);
            this.pinMessage(message);
            return true;
        }
    }

    isPinnable(message) {
        return message.embeds.length > 0 && (message.embeds[0].thumbnail || message.embeds[0].image) ||
            message.attachments.length > 0 && message.attachments[0].width;
    }

    pinMessage(message) {
        console.log('Pinning: ' + (message.embeds.length > 0 ? message.embeds[0].url : message.attachments[0].url));
        message.pin().catch(console.log);
        this.events.emit('google.save',
            message.attachments.length > 0 ? message.attachments[0].url
                : message.embeds[0].image ? message.embeds[0].image.url
                : message.embeds[0].thumbnail.url,
            this.options[message.channel.id].prependFolderName);

        if (message.embeds[0] && message.embeds[0].url) {
            let embed = message.embeds[0];
            let data = [];
            if (embed.title) data.push(embed.title);
            if (embed.description) data.push(embed.description);
            if (embed.fileds) data.concat(embed.fields.filter((v) => v.value));

            mongo.connect(this.server_db, (err, db) => {
                if (err) return console.log(err);
                db.collection('pins').insertOne({
                    data: data.join(' - '),
                    url: embed.url,
                }, (err) => {
                    if (err) console.log(err);
                    db.close();
                });
            });
        }
    }

    unpinMessage(message, collection) {
        console.log('Unpinning: ' + (message.embeds.length > 0 ? message.embeds[0].url : message.attachments[0].url));
        collection.splice(collection.indexOf(message), 1);

        if (message.embeds.length > 0){
            message.channel.createMessage('Removido: <' + message.embeds[0].url + '>');
        }
        if (message.attachments.length > 0){
            message.channel.createMessage('Removido: <' + message.attachments[0].url + '>');
        }

        message.unpin().catch(console.log);
    }
}
