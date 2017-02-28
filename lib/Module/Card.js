'use strict';
const mongo = require('mongodb');
const request = require('request');
const isUrl =  /^(?:\w+:)?\/\/([^\s\.]+\.\S{2})\S*$/;

module.exports =
class Card {
    constructor(services, options) {
        this.discord = services.discord;
        this.admins = options && options.admins || [];
        this.channels = options && options.channels || [];
        this.server_db = options && options.server_db;

        services.events.on('command.card', (i, m, a) => { this.onCard(i, m, a); });
        services.events.on('command.ficha', (i, m, a) => { this.onCard(i, m, a); });
    }

    isAdmin(user) {
        return user && this.admins.find((a) => a == user.id || user.roles.find((r) => r.id == a));
    }

    onCard(id, message, argv) {
        if (this.channels.indexOf(message.channel.id) == -1) return; //Drop
        let query = { type: 'user', target: message.author.id, guild: message.guild.id };
        let matches = argv[1] && argv[1].match(/^<(@|@!|@&|:|#)(\d+|\w+:\d+)>$/);
        if (matches) {
            query.type = matches[1] == '#' ? 'channel'
                    : matches[1] == '@&' ? 'role'
                    : matches[1] == '?' ? 'emoji'
                    : 'user';
            query.target = matches[2];
        }

        if ((argv[2] && isUrl.test(argv[2])) || message.attachments.length) {
            if (this.isAdmin(message.author.memberOf(message.guild))) {
                this.replaceCard(query, argv[2] || message.attachments[0].url)
                message.addReaction('\uD83D\uDC4D');
            } else {
                message.addReaction('\u274C');
            }
        } else {
            this.replyCard(message, query);
        }
    }

    replaceCard(query, url) {
        return new Promise((resolve, reject) => {
            return request(url, {encoding: null}, (e, r, body) => {
                if (e) { return reject(e); }
                return resolve(Buffer.from(body, 'binary'));
            });
        }).then((image) => {
            mongo.connect(this.server_db, (err, db) => {
                if (err) return console.log(err);
                db.collection('cards').updateOne(query, {
                    type: query.type,
                    target: query.target,
                    guild: query.guild,
                    file: image
                }, {upsert: true}, (err) => {
                    if (err) console.log(err);
                    db.close();
                });
            });
        }, console.log);
    }

    replyCard(message, query) {
        mongo.connect(this.server_db, (err, db) => {
            if (err) return console.log(err);
            db.collection('cards').findOne(query).then((data) => {
                if (data) {
                    message.channel.uploadFile(data.file.buffer, 'card.png').catch(console.log);
                } else {
                    message.addReaction('\u274C');
                }
                db.close();
            });
        });
    }
}
