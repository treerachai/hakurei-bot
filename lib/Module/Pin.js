'use strict';
const mongo = require('mongodb');

module.exports =
class Pin {
    constructor(services, options) {
        this.discord = services.discord;
        this.events = services.events;
        this.server_db = options && options.server_db;
        this.options = options && options.channels || {};

        this.loading = {};
        this.discord.Dispatcher.on('GATEWAY_READY', () => { this.onReady(); });
        this.discord.Dispatcher.on('MESSAGE_REACTION_ADD', (r, u) => { this.onReaction(r, u); });
        this.discord.Dispatcher.on('MESSAGE_CREATE', (e) => { this.onMessage(e); });
        this.discord.Dispatcher.on('MESSAGE_UPDATE', (e) => { this.onMessage(e); });
    }

    onReady() {
        for (let channelId in this.options){
            let channel = this.discord.Channels.get(channelId);
            if (channel) this.fetchPinnedMessages(channel).then(() => {
                this.parseMessages(channel, this.options[channel.id].parseMessageCount);
            });
        }
    }

    onReaction(event) {
        if (!this.options[event.channel.id]) return; // Ignore not registered channels
        if (event.emoji.name != this.options[event.channel.id].emojiName) return; // Ignore other emojis

        if (event.message) {
            let reaction = event.message.reactions.find((reaction) => {
                return reaction.emoji.name == this.options[event.channel.id].emojiName;
            })
            this.compareReactions(reaction, event.channel, event.message, event.channel.pinnedMessages);
        } else {
            event.channel.fetchMessage(event.data.message_id).then((event2) => {
                let reaction = event2.message.reactions.find((reaction) => {
                    return reaction.emoji.name == this.options[event.channel.id].emojiName;
                })
                this.compareReactions(reaction, event.channel, event2.message, event.channel.pinnedMessages.slice());
            }, console.log);
        }
    }

    onMessage(event) {
        if (!event.message) return; // Drop
        if (!this.options[event.message.channel.id]) return; // Drop
        if (this.loading[event.message.id]) return; // Drop

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

        if (this.isPinnable(event.message)) {
            this.loading[event.message.id] = true;
            if (event.message.reactions.length == 0) {
                event.message.addReaction(this.options[event.message.channel.id].emojiName);
            }
        }
    }

    parseMessages(channel, left) {
        return channel.fetchMessages(Math.min(left, 100), channel.messages[0]).then((data) => {

            var collection = channel.pinnedMessages.slice();
            var oldestPin = this.getOldest(collection);
            if (collection.length < this.options[channel.id].limit ||
                data.messages[0].timestamp >= oldestPin.timestamp) {

                data.messages.forEach((message) => {
                    let reaction = message.reactions.find((reaction) => {
                        return reaction.emoji.name == this.options[channel.id].emojiName;
                    });

                    if (reaction) {
                        this.compareReactions(reaction, channel, message, collection);
                    }

                    if ((!reaction || !reaction.me) && this.isPinnable(message)) {
                        message.addReaction(this.options[channel.id].emojiName);
                    }
                });
            }

            if (data.messages.length == 100 && left > 100) {
                return this.parseMessages(channel, left - data.messages.length);
            }
        }, console.log);
    }

    fetchPinnedMessages(channel) {
        return channel.fetchPinned().then((data) => {
            while (data.messages.length > this.options[channel.id].limit) {
                this.unpinMessage(this.getOldest(data.messages), data.messages);
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

        if (message.embeds[0].url) {
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
            message.channel.sendMessage('Removido: <' + message.embeds[0].url + '>');
        }
        if (message.attachments.length > 0){
            message.channel.sendMessage('Removido: <' + message.attachments[0].url + '>');
        }

        message.unpin().catch(console.log);
    }
}
