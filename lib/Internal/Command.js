'use strict';

module.exports =
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

    onMessageUpdate(message, old) {
        if (old.hasOwnProperty('content')) this.onMessage(message);
    }

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

    onMessageDelete(message) {
        if (this.commands[message.id]) {
            let command = this.commands[message.id];
            this.events.emit('command.' + command.name + '.delete', command.id);
        }
    }

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
