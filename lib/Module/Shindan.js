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
        this.channels = options && options.channels || [];
        this.data_dir = options && options.data_dir || '.';
        this.commands = {};
        try {
            this.currentShindan = 'https://en.shindanmaker.com/' + JSON.parse(fs.readFileSync(this.data_dir + '/shindan.json'));
        } catch(e) {}

        services.events.on('command.shindan', this.onShindan, this);
        services.events.on('command.shindan.delete', this.onDelete, this);
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
            this.getShindanResult(this.currentShindan, name).then((embed) => {
                embed.author.icon_url = message.author.avatarURL;
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

    /**
     * Retrieve the result of a Shindan request as a discord embed.
     *
     * @param {string} gameUrl - Shindan game url
     * @param {string} name - name to use as seed on shindan
     * @returns {Promise<Object>} Resolves into a embed object
     */
    getShindanResult(gameUrl, name) {
        return new Promise((resolve, reject) => {
            request.post({
                uri: gameUrl,
                formData: {u: name}
            }, (e, response, body) => {
                if (e) return reject(e);
                if (response.headers.location) return this.getShindanResult(response.headers.location, name).then(resolve, reject);
                if (response.statusCode != 200) return reject(response.statusMessage);

                body = cheerio.load(body);
                let result = (body('#copy_text').length ? body('#copy_text') : body('#copy_text_140'))
                    .text().trim().split('\n');
                let embed = {
                    color: 0x00C2FC,
                    author: {name},
                    title: body('.shindantitle2 a').text(),
                };
                for (let line of result) {
                    if (line[0] == '#') continue;
                    if (line == this.currentShindan) continue;

                    let chart = url.parse(line);
                    if (chart.host == 'en.shindanmaker.com' && chart.pathname.startsWith('/chart/')) {
                        embed.image = { url: 'http://chartimage.shindanmaker.com/' + chart.pathname.slice(7).replace('-', '/') + '.png' }
                    } else {
                        if (!embed.description) {
                            embed.description = '';
                        } else {
                            embed.description += '\n';
                        } embed.description += line;
                    }
                }

                resolve(embed);
            });
        });
    }
}
