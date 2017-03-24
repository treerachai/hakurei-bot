'use strict';

/**
 * Notify when a command with `commandName` is called.
 *
 * @memberof Events
 * @event "command.&lt;commandName&gt;"
 * @param {string} id - Command identifier.
 * @param message - Discord Message Object. See {@link https://abal.moe/Eris/docs/Message}
 * @param {string[]} - Array of command arguments, starting by the command name.
 */

/**
 * Notify when a command has its arguments modified.
 *
 * @memberof Events
 * @event "command.&lt;commandName&gt;.update"
 * @param {string} id - Command identifier. Same from from {@link Events.event:"command.&lt;commandName&gt;"}.
 * @param message - Discord Message Object. See {@link https://abal.moe/Eris/docs/Message}
 * @param {string[]} - Array of command arguments, starting by the command name.
 */

/**
 * Notify when a command have been deleted.
 *
 * @memberof Events
 * @event "command.&lt;commandName&gt;.delete"
 * @param {string} id - Command identifier. Same from from {@link Events.event:"command.&lt;commandName&gt;"}.
 */

module.exports =
/**
 * Module that manages messages with bot commands
 *
 * @class Internal.Command
 * @param {ServiceGroup} services - Service instances
 * @param {Object} options - Module options
 * @param {string} options.prefix - Prefix that commands must have to be recognized.
 * @fires Events.event:"command.&lt;commandName&gt;"
 * @fires Events.event:"command.&lt;commandName&gt;.update"
 * @fires Events.event:"command.&lt;commandName&gt;.delete"
 */
class Command {
    constructor(services, options) {
        this.discord = services.discord;
        this.events = services.events;
        this.prefix = options && options.prefix || '!';

        this.commands = {};
        this.nextId = 1;

        this.discord.on('messageCreate', this.onMessage, this);
        this.discord.on('messageUpdate', this.onMessageUpdate, this);
        this.discord.on('messageDelete', this.onMessageDelete, this);
    }

    /**
     * Handle Discord Message Update Event
     * @method Internal.Command#onMessageUpdate
     * @see https://abal.moe/Eris/docs/Client#event-messageUpdate
     */
    onMessageUpdate(message, old) {
        if (old.hasOwnProperty('content')) this.onMessage(message);
    }

    /**
     * Handle Discord Message Create Event
     * @method Internal.Command#onMessage
     * @see https://abal.moe/Eris/docs/Client#event-messageCreate
     */
    onMessage(message) {
        if (message.author.id == this.discord.user.id) return; // Drop

        if (message.content.startsWith(this.prefix)) {
            let argv = this.parseArgs(message.content);
            if (!argv[0]) return;
            let commandName = argv[0].toLowerCase();

            if (this.commands[message.id]) {
                let command = this.commands[message.id];
                if (message.content == command.content) return; // Drop

                if (command.name == commandName) {
                    command.content = message.content;
                    this.events.emit('command.' + commandName + '.update', command.id, message, argv);
                } else {
                    this.events.emit('command.' + command.name + '.delete', command.id);
                    command.content = message.content;
                    command.name = commandName;
                    this.events.emit('command.' + commandName, command.id, message, argv);
                }
            } else {
                this.commands[message.id] = {
                    id: (this.nextId++).toString(),
                    content: message.content,
                    name: commandName
                };
                this.events.emit('command.' + commandName, this.commands[message.id].id, message, argv);
            }
        }
    }

    /**
     * Handle Discord Message Delete Event
     * @method Internal.Command#onMessageDelete
     * @see https://abal.moe/Eris/docs/Client#event-messageDelete
     */
    onMessageDelete(message) {
        if (this.commands[message.id]) {
            let command = this.commands[message.id];
            this.events.emit('command.' + command.name + '.delete', command.id);
        }
    }

    /**
     * Parse arguments from a string command.
     * @method Internal.Command#parseArgs
     * @param {string} content - Command string.
     * @return {string[]} Parsed arguments
     */
    parseArgs(content) {
        var argv = content.slice(this.prefix.length).match(/[^\s"']+|"[^"]*"|'[^']*'/g) || [];
        argv.forEach((v, i) => {
            if (v[0] === '"' || v[0] === "'") {
                argv[i] = v.slice(1,-1);
            }
        });
        return argv;
    }
}
