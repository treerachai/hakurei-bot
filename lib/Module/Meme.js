'use strict';
const request = require('request');
const isUrl =  /^\w+:\/\/([^\s\.]+\.\S{2})\S*$/;

module.exports =
/**
 * Gives ability to attach images to any message.
 *
 * Command syntax: `!card [<mentionOrEmoji> [<url>]]`.
 *
 * If an `url` or an attachment image is set, it attachs it to `mentionOrEmoji`, otherwise it retrives the last image attached to it.
 * Default `mentionOrEmoji`: Command's author.
 *
 * @constructor Module.Meme
 * @param {ServiceGroup} services - Service instances
 * @param {Object} options - Module options
 * @param {string[]} options.channels - Array of channel ids where this module should be active
 */
class Meme {
    constructor(services, options) {
        this.channels = options && options.channels || [];
        this.mongo = services.mongoConnect;

        services.events.on('command.meme', this.onMeme, this);
    }

    /**
     * Handle `meme` command events
     * @method Module.Meme#onMeme
     * @listens Events.event:"command.&lt;commandName&gt;"
     */
    onMeme(id, message, argv) {
        if (this.channels.indexOf(message.channel.id) == -1) return; //Drop

        let url = (argv[2] && isUrl.test(argv[2])) ? argv[2]
            : message.attachments.length ? message.attachments[0].url
            : null;
        if (url) {
            this.replaceMeme({
                target: argv[1] || '<@!' + message.author.id + '>',
                guild: message.channel.guild.id
            }, url);
            message.addReaction('\uD83D\uDC4D');
        } else {
            this.replyMeme(message, {
                target: argv[1] || {$in: ['<@!' + message.author.id + '>', '<@' + message.author.id + '>']},
                guild: message.channel.guild.id
            });
        }
    }

    /**
     * Replace an attached image.
     *
     * @method Module.Meme#replaceMeme
     * @param {Object} query - Database query object representing the object to attach the image
     * @param {string} query.target - Referenced string target.
     * @param {string} query.guild - Discord guild id.
     * @param {string} url - Image url.
     */
    replaceMeme(query, url) {
        new Promise((resolve, reject) => {
            return request(url, {encoding: null}, (e, r, body) => {
                if (e) { return reject(e); }
                return resolve(Buffer.from(body, 'binary'));
            });
        }).then((image) => {
            this.mongo().then((db) => {
                db.collection('cards').updateOne(query, {
                    type: query.type,
                    target: query.target,
                    guild: query.guild,
                    file: image
                }, {upsert: true});
            });
        });
    }

    /**
     * Reply a message with the attached image.
     *
     * @method Module.Meme#replyMeme
     * @param message - Discord message to reply. See {@link https://abal.moe/Eris/docs/Message}
     * @param {Object} query - Database query object representing the object to retrieve the image
     * @param {string} query.target - Referenced string target.
     * @param {string} query.guild - Discord guild id.
     */
    replyMeme(message, query) {
        this.mongo().then((db) => {
            db.collection('cards').findOne(query).then((data) => {
                if (data) {
                    message.channel.createMessage(null, {file: data.file.buffer, name: 'meme.png'});
                } else {
                    message.addReaction('\u274C');
                }
            });
        });
    }
}
