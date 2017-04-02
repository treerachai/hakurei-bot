'use strict';

module.exports =
/**
 * Steal Game Module
 * @constructor Module.Steal
 * @param {Services} services - Service instances
 * @param {Object} options - Module options
 * @param {string[]} options.admins - Array of user and/or role ids that have permision to start the game
 * @param {string[]} options.ranks - Array of ranks to show on game end.
 */
class Steal {
    constructor(services, options) {
        this.discord = services.discord;
        this.admins = options && options.admins || [];
        this.ranks = options && options.ranks || ['1', '2', '3'];
        this.channels = {};
        this.steals = {};

        services.events.on('command.startsteal', this.onStart, this);
        services.events.on('command.steal', this.onSteal, this);
        services.events.on('command.steal.delete', this.onThrow, this);
    }

    /**
     * Verify if a Discord member is an authorized admin.
     * @method Module.Steal#isAdmin
     * @param {Member} user - Discord guild member.
     */
    isAdmin(user) {
        return user && this.admins.find((a) => a == user.id || user.roles.find((r) => r == a));
    }

    /**
     * Handle Events#command.startsteal event
     * @method Module.Steal#onStart
     * @param {string} id - Command id
     * @param {Message} message - Discord message instance
     * @param {string[]} argv - Parsed arguments
     * @listens Events#command.startsteal
     */
    onStart(id, message, argv) {
        var channelId = message.channel.id;
        if (!this.isAdmin(message.member)) return; // Drop
        if (this.channels[channelId]) return; //Drop

        this.channels[channelId] = {
            timeout: setTimeout(() => {this.onEnd(channelId)}, 60000 * (parseInt(argv[1]) || 60)),
            thieves: {},
        };
        message.channel.createMessage('Steal Game Started!'
            + '\nType `!steal <letters>` to steal the letters from previous messages\'s author\'s nickname.'
            + '\nYou have '+ (parseInt(argv[1]) || 60) + ' minutes.');
    }

    /**
     * Finish the game in a channel.
     * @method Module.Steal#onEnd
     * @param {string} - Discord channel id.
     */
    onEnd(channelId) {
        let thieves = Object.values(this.channels[channelId].thieves).sort((a, b) => b.count - a.count);
        let embed = {
            title: 'Steal Game Results',
            description: ''
        };

        for (let i = 0; i < thieves.length && i < this.ranks.length; i++) {
            if (i == 0) {
                embed.thumbnail = {url: thieves[i].avatarURL};
            } else {
                embed.description += '\n';
            }
            embed.description += this.ranks[i] + '\t**' + thieves[i].userName + '**[' + thieves[i].count + ']';
        }
        delete this.channels[channelId];
        this.discord.getChannel(channelId).createMessage({embed});
    }

    /**
     * Handle Events#command.steal event
     * @method Module.Steal#onSteal
     * @param {string} id - Command id
     * @param {Message} message - Discord message instance
     * @param {string[]} argv - Parsed arguments
     * @listens Events#command.steal
     */
    onSteal(id, message, argv) {
        if (!this.channels[message.channel.id]) return; //Drop

        // TODO Optimize Search
        let target;
        for (let m of message.channel.messages.values()) {
            if (m.id == message.id) break;
            if (m.member && !m.member.bot) target = m.member;
        }

        let source = message.member;
        let sourceName = source.nick || source.username;
        let targetName = target.nick || target.username;
        let pos = Math.floor(Math.random() * sourceName.length + 1);

        if (argv[1].length <= 0
            || !target
            || target.id == source.id
            || argv[1] == targetName
            || targetName.indexOf(argv[1]) == -1 ) {

            return message.addReaction('\u274C');
        }

        target.edit({nick: targetName.replace(argv[1], '')}).then(() => {
            source.edit({nick: sourceName.slice(0, pos) + argv[1] + sourceName.slice(pos)}).then(() => {
                return this.onSuccessfulSteal(this.steals[id] = {
                    message: message,
                    source: source,
                    target: target,
                    content: argv[1]
                });
            }, () => {
                target.edit({nick: targetName});
                return message.addReaction('\u274C');
            })
        }, () => {
            return message.addReaction('\u274C');
        })
    }

    /**
     * Notify whens a successful steal is executed and save its score
     * @method Module.Steal#onSuccessfulSteal
     * @param {Object} data
     * @param {Message} data.message - Discord Message Object. See {@link https://abal.moe/Eris/docs/Message}
     * @param {GuildMember} data.source - Discord GuildMember Object. See {@link https://abal.moe/Eris/docs/Message}
     * @param {GuildMember} data.target - Discord GuildMember Object. See {@link https://abal.moe/Eris/docs/Message}
     * @param {string} data.content
     */
    onSuccessfulSteal(data) {
        data.message.channel.createMessage(data.source.mention + ' steals ' + data.content).then((message) => {
            let gameStat = this.channels[data.message.channel.id];
            if (gameStat.thieves[data.source.id]) {
                gameStat.thieves[data.source.id].count++;
            } else {
                gameStat.thieves[data.source.id] = {
                    count: 1,
                    userName: data.source.username,
                    avatarURL: data.source.avatarURL,
                };
            }
        });
    }

    /**
     * Handle Events#command.steal deleteion event
     * @method Module.Steal#onThrow
     * @param {string} id - Command id
     * @listens Events#command.steal.delete
     */
    onThrow(id) {
        var steal = this.steals[id];
        if (steal) {
            var index;
            if (steal.source && (index = steal.source.nick.indexOf(steal.content))) {
                steal.source.edit({nick: steal.source.nick.replace(steal.content, '')}).then(() => {
                    steal.message.edit(steal.source.mention + " throws " + steal.content + " away.");
                    this.channels[steal.message.channel.id].thieves[steal.source.id].count--;
                    delete this.steals[id];
                });
            }
        }
    }
}
