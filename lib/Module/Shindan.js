'use strict';
const cheerio = require('cheerio');
const fs = require('fs');
const request = require('request');
const url = require('url');
const options = require('../Options.js')();

module.exports =
class Batoto {
    constructor(client) {
        this.client = client;
        this.currentShindan = 'https://en.shindanmaker.com/' + JSON.parse(fs.readFileSync(options.dir.data + '/shindan.json'));

        client.Dispatcher.on('MESSAGE_CREATE', (e) => { this.onMessage(e); });
    }

    onMessage(event) {
        if (event.message.author.id == this.client.User.id) return; // Drop
        if (options.shindan.channels.indexOf(event.message.channel.id) == -1) return; //Drop

        if (event.message.content.startsWith('!shindan')) {
            let number = event.message.content.slice(9);
            if (number && /^\d+$/.test(number)) {
                this.currentShindan = 'https://en.shindanmaker.com/' + number;
                fs.writeFile(options.dir.data + '/shindan.json', JSON.stringify(number));
                event.message.addReaction('\uD83D\uDC4D');
            } else {
                let name = event.message.author.name || event.message.author.username;
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
                            name: event.message.author.name || event.message.author.username,
                            icon_url: event.message.author.avatarURL,
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
                    event.message.channel.sendMessage(this.currentShindan, false, embed);
                });
            }
        }
    }
}
