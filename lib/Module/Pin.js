'use strict';
const fs = require('fs');
const mongo = require('mongodb');

module.exports =
class Pin {
    constructor(services, options) {
        this.discord = services.discord;
        this.events = services.events;

        this.confirmTimeout = options && options.confirmTimeout || 60;
        this.data_dir = options && options.data_dir || '.';
        this.options = options && options.channels || {};
        this.server_db = options && options.server_db;

        this.loading = {};
        this.pins = {};
        this.waiting = {};

        this.discord.on('ready', this.onReady, this);
        this.discord.on('messageReactionAdd', this.onReaction, this);
        this.discord.on('messageCreate', this.onMessage, this);
        this.discord.on('messageUpdate', this.onMessageUpdate, this);
        this.events.on('command.confirm', this.onConfirm, this);
    }

    onMessageUpdate(message, old) {
        if (old.hasOwnProperty('content')) this.onMessage(message);

        if (message.pinned) {
            if (!this.options[message.channel.id]) return; // Drop
            if (this.pins[message.channel.id].find(m => message.id == m.id)) return; //Drop

            if (!this.waiting[message.channel.id]) {
                this.waiting[message.channel.id] = {
                    timeout : setTimeout(() => {
                        let messages = this.pins[message.channel.id];
                        messages.push(...this.waiting[message.channel.id].messages);
                        while (messages.length > this.options[message.channel.id].limit) {
                            this.unpinMessage(this.getOldest(messages), messages);
                        }
                        delete this.waiting[message.channel.id];
                    }, this.confirmTimeout * 1000),
                    messages: []
                }
            }

            this.waiting[message.channel.id].messages.push(message);
            message.channel.createMessage("To make this pin permanent, type `!confirm`.");
        }
    }

    onReady() {
        for (let channelId in this.options) {
            this.pins[channelId] = [];
            let channel = this.discord.getChannel(channelId);
            if (channel) this.fetchPinnedMessages(channel).then(() => {
                this.parseMessages(channel, this.options[channel.id].parseMessageCount);
            });
        }
    }

    onReaction(message, emoji, userId) {
        if (!this.options[message.channel.id]) return; // Drop
        if (emoji.name != this.options[message.channel.id].emojiName) return; // Drop

        if (message.reactions && message.channel) {
            let reaction = message.reactions[emoji.name];
            this.compareReactions(reaction, message.channel, message, this.pins[message.channel.id]);
        } else {
            message.channel.getMessage(message.id).then((message) => {
                let reaction = message.reactions[emoji.name];
                this.compareReactions(reaction, message.channel, message, this.pins[message.channel.id]);
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

    onConfirm(id, message, argv) {
        if (!this.waiting[message.channel.id]) return; // Drop

        clearTimeout(this.waiting[message.channel.id].timeout);
        let permanentPins = {};
        try {
            permanentPins = JSON.parse(fs.readFileSync(this.data_dir + '/permanentPins.json'));
        } catch(e) { }

        if (!permanentPins[message.channel.id]) permanentPins[message.channel.id] = [];
        for (let m of this.waiting[message.channel.id].messages){
            permanentPins[message.channel.id].push(m.id);
        }
        delete this.waiting[message.channel.id];
        fs.writeFile(this.data_dir + '/permanentPins.json', JSON.stringify(permanentPins));
        message.addReaction('\uD83D\uDC4D');
    }

    parseMessages(channel, left) {
        return channel.getMessages(Math.min(left, 100), channel.messages[0]).then((messages) => {

            var oldestPin = this.getOldest(this.pins[channel.id]);
            if (this.pins[channel.id].length < this.options[channel.id].limit ||
                messages[0].timestamp >= oldestPin.timestamp) {

                messages.forEach((message) => {
                    let reaction = message.reactions[this.options[channel.id].emojiName];

                    if (reaction) {
                        this.compareReactions(reaction, channel, message, this.pins[channel.id]);
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
            this.pins[channel.id] = messages;
            let permanentPins = {};
            try {
                permanentPins = JSON.parse(fs.readFileSync(this.data_dir + '/permanentPins.json'));
            } catch(e) { }

            if (!permanentPins[channel.id]) permanentPins[channel.id] = [];
            for(let messageId of permanentPins[channel.id]) {
                let index = messages.findIndex(m => m.id == messageId);
                if (index != -1) messages.splice(index, 1);
            }

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
