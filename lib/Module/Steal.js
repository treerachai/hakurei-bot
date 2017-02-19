'use strict';

module.exports =
class Steal {
    constructor(services, options) {
        this.discord = services.discord;
        this.channels = options && options.channels || [];
        this.steals = {};

        this.discord.Dispatcher.on('GATEWAY_READY', () => { this.onReady(); });
        services.events.on('command.steal', (i, m, a) => { this.onSteal(i, m, a); });
        services.events.on('command.steal.delete', (i) => { this.onThrow(i); });
    }

    onReady() {
        for (let channelId of this.channels) {
            this.discord.Channels.get(channelId).fetchMessages(5);
        }
    }

    onSteal(id, message, argv) {
        if (this.channels.indexOf(message.channel.id) == -1) return; //Drop

        let messages = message.channel.messages;
        let index = messages.length;

        for (;index--;) {
            if (messages[index].id == message.id) {
                while(messages[--index].author.bot);
                break;
            }
        }

        let source = message.author.memberOf(message.guild);
        let target = messages[index].author.memberOf(message.guild);
        let oldName = target.name;
        let pos = Math.floor(Math.random() * source.name.length+1);

        if (argv[1].length <= 0
            || !target
            || target.id == source.id
            || argv[1] == target.name
            || target.name.indexOf(argv[1]) == -1 ) {

            return message.addReaction('\u274C');
        }

        target.setNickname(target.name.replace(argv[1], '')).then(() => {
            source.setNickname(source.name.slice(0, pos) + argv[1] + source.name.slice(pos)).then(() => {
                return message.reply('nice').then((message) => {
                    this.steals[id] = {
                        message: message,
                        source: source.id,
                        target: target.id,
                        content: argv[1]
                    };
                });
            }, () => {
                target.setNickname(oldName);
                return message.addReaction('\u274C');
            })
        }, () => {
            return message.addReaction('\u274C');
        })
    }

    onThrow(id) {
        var steal = this.steals[id];
        if (this.steals[id]) {
            var source = steal.message.guild.members.find((m) => m.id == steal.source);
            var index;
            if (source && (index = source.name.indexOf(steal.content))) {
                source.setNickname(source.name.replace(steal.content, '')).then(() => {
                    steal.message.edit(source.mention + " throws " + steal.content + " away.");
                    delete this.steals[id];
                }, console.log)
            }
        }
    }
}
