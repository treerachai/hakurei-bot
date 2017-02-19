'use strict';

module.exports =
class Command {
    constructor(services, options) {
        this.discord = services.discord;
        this.events = services.events;
        this.prefix = options && options.prefix || '!';

        this.commands = {};
        this.nextId = 1;

        this.discord.Dispatcher.on('MESSAGE_CREATE', (e) => { this.onMessage(e); });
        this.discord.Dispatcher.on('MESSAGE_UPDATE', (e) => { this.onMessage(e); });
        this.discord.Dispatcher.on('MESSAGE_DELETE', (e) => { this.onMessageDelete(e); });
    }

    onMessage(event) {
        if (!event.message) return; // Drop
        if (event.message.author.id == this.discord.User.id) return; // Drop

        if (event.message.content.startsWith(this.prefix)) {
            let argv = this.parseArgs(event.message.content);
            if (!argv[0]) return;
            let commandName = argv[0].toLowerCase();

            if (this.commands[event.message.id]) {
                let command = this.commands[event.message.id];
                if (event.message.content == command.content) return;
                if (command.name == commandName) {
                    command.content = event.message.content;
                    this.events.emit('command.' + commandName + '.update', command.id, event.message, argv);
                } else {
                    this.events.emit('command.' + command.name + '.delete', command.id);
                    command.content = event.message.content;
                    command.name = commandName;
                    this.events.emit('command.' + commandName, command.id, event.message, argv);
                }
            } else {
                this.commands[event.message.id] = {
                    id: (this.nextId++).toString(),
                    content: event.message.content,
                    name: commandName
                };
                this.events.emit('command.' + commandName, this.commands[event.message.id].id, event.message, argv);
            }
        }
    }

    onMessageDelete(event) {
        if (this.commands[event.messageId]) {
            let command = this.commands[event.message.id];
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
