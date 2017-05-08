'use strict';

/**
 * Declare an owner for a message
 *
 * @memberof Events
 * @event "ownership"
 * @param {string} messageId - Discord Message Id
 * @param {string} authorId - Discord User Id of this message's owner
 */

module.exports =
/**
 * Declare ownership of messages allowing an user delete it using reactions
 *
 * @constructor Module.Ownership
 * @param {ServiceGroup} services - Service instances
 * @param {Object} options - Module options
 * @param {string[]} options.deleteEmojiName - Array of channel ids where this module should be active
 */
class Ownership {
    constructor(services, options) {
        this.deleteEmojiName = options && options.deleteEmojiName || "\u274C";
        this.messages = {};

        services.events.on('ownership', this.onOwnership, this);
        services.discord.on('messageReactionAdd', this.onReaction, this);
    }

    /**
     * Handle `ownership` events
     * @method Module.Ownership#onOwnership
     * @listens Events.event:"ownership"
     */
    onOwnership(messageId, authorId) {
        this.messages[messageId] = authorId;
    }

    /**
     * Handle Discord Reaction Event
     * @method Module.Ownership#onReaction
     * @see https://abal.moe/Eris/docs/Client#event-messageReactionAdd
     */
    onReaction(message, emoji, userId) {
        if (emoji.name == this.deleteEmojiName && this.messages[message.id] === userId && message.delete) {
            message.delete();
        }
    }
}
