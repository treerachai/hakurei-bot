'use strict';
const cheerio = require('cheerio');
const fs = require('fs');
const request = require('request');
const url = require('url');

module.exports =
/**
 * Shindan Game Module
 *
 * Command syntax: `!shindan [<number>]`.
 *
 * If shindan is defined then set the current shindan game to be the game with that number.
 * Otherwise make a shindan request using de author's name as param and reply the result.
 *
 * @constructor Module.Shindan
 * @param {ServiceGroup} services - Service instances
 * @param {Object} options - Module options
 * @param {string[]} options.channels - Array of channel ids where this module should be active
 */
class Shindan {
    constructor(services, options) {
        this.events = services.events;
        this.channels = options && options.channels || [];
        this.data_dir = options && options.data_dir || '.';
        this.commands = {};
        try {
            this.currentShindan = 'https://en.shindanmaker.com/' + JSON.parse(fs.readFileSync(this.data_dir + '/shindan.json'));
        } catch(e) {}

        this.events.on('command.shindan', this.onShindan, this);
        this.events.on('command.shindan.delete', this.onDelete, this);
    }

    /**
     * Handle `shindan` commands events
     * @method Module.Shindan#onShindan
     * @listens Events.event:"command.&lt;commandName&gt;"
     */
    onShindan(id, message, argv) {
        if (this.channels.indexOf(message.channel.id) == -1) return; //Drop

        if (argv[1] && /^\d+$/.test(argv[1])) {
            this.currentShindan = 'https://en.shindanmaker.com/' + argv[1];
            fs.writeFile(this.data_dir + '/shindan.json', JSON.stringify(argv[1]));
            message.addReaction('\uD83D\uDC4D');
        } else if (this.currentShindan) {
            let name = (message.member && message.member.nick) || message.author.username;
            request.post({
                uri: this.currentShindan,
                formData: {u: name}
            }, (error, response, body) => {
                body = cheerio.load(body);
                let result = (body('#copy_text').length ? body('#copy_text') : body('#copy_text_140'))
                    .text().trim().split('\n');
                let embed = {
                    color: 0x00C2FC,
                    author: {
                        name: name,
                        icon_url: message.author.avatarURL,
                    },
                    title: body('title').text(),
                };
                for (let i in result) {
                    if (result[i][0] == '#') continue;
                    if (result[i] == this.currentShindan) continue;
                    let chart = url.parse(result[i]);
                    if (chart.host == 'en.shindanmaker.com' && chart.pathname.startsWith('/chart/')) {
                        embed.image = { url: 'http://chartimage.shindanmaker.com/' + chart.pathname.slice(7).replace('-', '/') + '.png' }
                    } else {
                        if (!embed.description) embed.description = '';
                        if (i != 0) embed.description += '\n';
                        embed.description += result[i];
                    }
                }
                message.channel.createMessage({content: this.currentShindan, embed}).then((message) => {
                    this.commands[id] = message;
                });
            });
        }
    }

    /**
     * Handle `shindan` command delete events
     * @method Module.Shindan#onDelete
     * @listens Events.event:"command.&lt;commandName&gt;.delete"
     */
    onDelete(id) {
        if (this.commands[id]) {
            this.commands[id].delete();
            delete this.commands[id];
        }
    }
}
