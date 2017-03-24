'use strict';
const mongo = require('mongodb');
const request = require('request');
const isUrl =  /^\w+:\/\/([^\s\.]+\.\S{2})\S*$/;

module.exports =
/**
 * Gives ability to attach images to Users, Channels, Roles and Emojis.
 *
 * Command syntax: `!card [<mentionOrEmoji> [<url>]]`.
 *
 * If an `url` or an attachment image is set, it attachs it to `mentionOrEmoji`, otherwise it retrives the last image attached to it.
 * Default `mentionOrEmoji`: Command's author.
 *
 * @constructor Module.Card
 * @param {ServiceGroup} services - Service instances
 * @param {Object} options - Module options
 * @param {string[]} options.channels - Array of channel ids where this module should be active
 * @param {string} options.admins - Array of user and/or role ids that have permision to set cards
 */
class Card {
    constructor(services, options) {
        this.admins = options && options.admins || [];
        this.channels = options && options.channels || [];
        this.server_db = options && options.server_db;

        services.events.on('command.card', this.onCard, this);
        services.events.on('command.ficha', this.onCard, this);
    }

    /**
     * Verify if a Discord member is an authorized admin.
     *
     * @method Module.Card#isAdmin
     * @param user - Discord guild member. See {@link https://abal.moe/Eris/docs/GuildMember}
     */
    isAdmin(user) {
        return user && this.admins.find((a) => a == user.id || user.roles.find((r) => r == a));
    }

    /**
     * Handle `card` and `ficha` commands events
     * @method Module.Card#onCard
     * @listens Events.event:"command.&lt;commandName&gt;"
     */
    onCard(id, message, argv) {
        if (this.channels.indexOf(message.channel.id) == -1) return; //Drop

        let query = { type: 'user', target: message.author.id, guild: message.channel.guild.id };
        let matches = argv[1] && argv[1].match(/^<(@|@!|@&|:|#)(\d+|\w+:\d+)>$/);
        if (matches) {
            query.type = matches[1] == '#' ? 'channel'
                    : matches[1] == '@&' ? 'role'
                    : matches[1] == '?' ? 'emoji'
                    : 'user';
            query.target = matches[2];
        }

        let url = (argv[2] && isUrl.test(argv[2])) ? argv[2]
            : message.attachments.length ? message.attachments[0].url
            : null;
        if (url) {
            if (this.isAdmin(message.member)) {
                this.replaceCard(query, url);
                message.addReaction('\uD83D\uDC4D');
            } else {
                message.addReaction('\u274C');
            }
        } else {
            this.replyCard(message, query);
        }
    }

    /**
     * Replace an attached image.
     *
     * @method Module.Card#replaceCard
     * @param {Object} query - Database query object representing the object to attach the image
     * @param {string} query.type - Type of object: `user`, `channel`, `role` or `emoji`.
     * @param {string} query.target - Object representation id.
     * @param {string} query.guild - Discord guild id.
     * @param {string} url - Image url.
     */
    replaceCard(query, url) {
        new Promise((resolve, reject) => {
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

    /**
     * Reply a message with the attached image.
     *
     * @method Module.Card#replyCard
     * @param message - Discord message to reply. See {@link https://abal.moe/Eris/docs/Message}
     * @param {Object} query - Database query object representing the object to retrieve the image
     * @param {string} query.type - Type of object: `user`, `channel`, `role` or `emoji`.
     * @param {string} query.target - Object representation id.
     * @param {string} query.guild - Discord guild id.
     */
    replyCard(message, query) {
        mongo.connect(this.server_db, (err, db) => {
            if (err) return console.log(err);
            db.collection('cards').findOne(query).then((data) => {
                if (data) {
                    message.channel.createMessage(null, {file: data.file.buffer, name: 'card.png'}).catch(console.log);
                } else {
                    message.addReaction('\u274C');
                }
                db.close();
            });
        });
    }
}
