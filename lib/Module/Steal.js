'use strict';
const options = require('../Options.js')();

module.exports =
class Batoto {
    constructor(client) {
        this.client = client;
        this.loading = {};

        client.Dispatcher.on('GATEWAY_READY', () => { this.onReady(); });
        client.Dispatcher.on('MESSAGE_CREATE', (e) => { this.onMessage(e); });
        client.Dispatcher.on('MESSAGE_UPDATE', (e) => { this.onMessage(e); });
    }

    onReady() {
        for (let channelId of options.steal.channels) {
            this.client.Channels.get(channelId).fetchMessages(5);
        }
    }
    onMessage(event) {
        if (!event.message) return; // Drop
        if (event.message.author.id == this.client.User.id) return; // Drop
        if (options.steal.channels.indexOf(event.message.channel.id) == -1) return; //Drop
        if (this.loading[event.message.id]) return; // Drop

        if (event.message.content.startsWith('!steal ')) {
            this.loading[event.message.id] = true;
            let letters = event.message.content.slice(7);
            let messages = event.message.channel.messages;
            let index = messages.length;

            for (;index--;) {
                if (messages[index].id == event.message.id) {
                    while(messages[--index].author.bot);
                    break;
                }
            }

            let source = event.message.author.memberOf(event.message.guild);
            let target = messages[index].author.memberOf(event.message.guild);
            let oldName = target.name;
            let pos = Math.floor(Math.random() * source.name.length+1);

            if (letters.length <= 0
                || !target
                || target.id == source.id
                || letters == target.name
                || target.name.indexOf(letters) == -1 ) {

                return event.message.addReaction('\u274C');
            }

            target.setNickname(target.name.replace(letters, '')).then(() => {
                source.setNickname(source.name.slice(0, pos) + letters + source.name.slice(pos)).then(() => {
                    return event.message.reply('nice');
                }, () => {
                    target.setNickname(oldName);
                    return event.message.addReaction('\u274C');
                })
            }, () => {
                return event.message.addReaction('\u274C');
            })
        }
    }
}
