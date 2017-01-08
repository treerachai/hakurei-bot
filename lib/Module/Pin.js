'use strict';
const http = require('http');
const options = require('../Options')();

module.exports =
class Pin {
    constructor(client) {
        this.client = client;
        client.Dispatcher.on('GATEWAY_READY', () => { this.onReady(); });
        client.Dispatcher.on('MESSAGE_REACTION_ADD', (r, u) => { this.onReaction(r, u); });
    }

    onReady() {
        for (let channelId in options.pin){
            let channel = this.client.Channels.get(channelId);
            if (channel) this.fetchPinnedMessages(channel).then(() => {
                this.parseMessages(channel, options.pin[channel.id].parseMessageCount);
            });
        }
    }

    onReaction(event) {
        if (!options.pin[event.channel.id]) return; // Ignore not registered channels
        if (escape(event.emoji.name) != options.pin[event.channel.id].emojiName) return; // Ignore other emojis

        if (event.message) {
            let reaction = event.message.reactions.find((reaction) => {
                return escape(reaction.emoji.name) == options.pin[event.channel.id].emojiName;
            })
            this.compareReactions(reaction, event.channel, event.message, event.channel.pinnedMessages);
        } else {
            event.channel.fetchMessage(event.data.message_id).then((event2) => {
                let reaction = event2.message.reactions.find((reaction) => {
                    return escape(reaction.emoji.name) == options.pin[event.channel.id].emojiName;
                })
                this.compareReactions(reaction, event.channel, event2.message, event.channel.pinnedMessages);
            }, console.log);
        }
    }

    parseMessages(channel, left) {
        return channel.fetchMessages(Math.min(left, 100), channel.messages[0]).then((data) => {

            var collection = channel.pinnedMessages.slice();
            var oldestPin = this.getOldest(collection);
            if (collection.length < options.pin[channel.id].limit ||
                data.messages[0].timestamp >= oldestPin.timestamp) {

                data.messages.forEach((message) => {
                    let reaction = message.reactions.find((reaction) => {
                        return escape(reaction.emoji.name) == options.pin[channel.id].emojiName;
                    });

                    if (reaction) {
                        this.compareReactions(reaction, channel, message, collection);
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
            while (data.messages.length > options.pin[channel.id].limit) {
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
        var channelOptions = options.pin[channel.id];
        if (reaction.count >= channelOptions.emojiCount &&
            !collection.find((m) => { return m.id == message.id; }) &&
                (message.embeds.length > 0 && message.embeds[0].thumbnail ||
                message.attachments.length > 0 && message.attachments[0].width) ) {

            var oldestPin = this.getOldest(collection);
            if (oldestPin && oldestPin.timestamp >= message.timestamp) {
                return false;
            }

            if (collection.length >= channelOptions.limit) {
                this.unpinMessage(oldestPin, collection);
            }

            this.pinMessage(message);
            return true;
        }
    }

    pinMessage(message) {
        console.log('Pinning: ' + (message.embeds.length > 0 ? message.embeds[0].url : message.attachments[0].url));
        message.pin().catch(console.log);
        this.saveImage(message.embeds.length  > 0 ? message.embeds[0].thumbnail.url : message.attachments.first().url,
            options.pin[message.channel.id].prependFolderName);
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

    saveImage(imageUrl, prependName) {
        require('../Util/Google').saveUrl(imageUrl, prependName);
    }
}
