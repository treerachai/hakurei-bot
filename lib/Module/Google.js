'use strict';
const options = require('../Options')();
const fs = require('fs');
const request = require('request');
const gapi = require('googleapis');
const gauth = new gapi.auth.OAuth2(
    options.google.clientId,
    options.google.clientSecret,
    'http://' + options.server.hostname + options.google.redirectPath
);
const gdrive = gapi.drive('v3');

module.exports =
class Google {
    constructor(client, server, events) {
        if (!this.loadCredentials()){
            console.log('Credentials Couldn\'t be loaded. Access the following link to reset Credentials.');
            console.log(this.generateAuthUrl());
        }

        client.Dispatcher.on('MESSAGE_CREATE', (e) => { this.onMessage(e); });
        server.get(options.google.redirectPath, (req, res) => { this.onServerRequest(req, res) });
        events.on('google.save', (u, p) => { this.onSave(u, p); })
    }

    onMessage(event) {
        if (event.message.content == '!googleUrl') {
            event.message.reply(this.generateAuthUrl());
        }
    }

    onSave(url, prependName) {
        console.log('Saving');
        this.fetchGroupFolder(prependName).then((folderId) => {
            gdrive.files.create({
                resource: {
                    name: Date.now(),
                    parents: [folderId],
                },
                media: {
                    body: request(url),
                }
            }, (err) => {if (err) throw err;});
        }, console.log);
    }

    onServerRequest(req, res) {
        var successful = false;
        gauth.getToken(req.query.code, (err, credentials) => {
            if (err) return console.log(err);
            fs.writeFile(options.dir.data + '/gauth.json', JSON.stringify(credentials));
            gauth.setCredentials(credentials);
            gapi.options({auth: gauth});
            console.log('Google credentials renewed.');
            res.render('index',{});
        });
    }

    generateAuthUrl() {
        return gauth.generateAuthUrl({
            access_type: 'offline',
            scope: 'https://www.googleapis.com/auth/drive'
        });
    }

    loadCredentials() {
        try {
            var credentials = JSON.parse(fs.readFileSync(options.dir.data + '/gauth.json'));
            gauth.setCredentials(credentials);
            gapi.options({auth: gauth});
        } catch(e) {
            return false;
        }
        return true;
    }

    fetchGroupFolder(prependName) {
        return new Promise((resolve, reject) => {
            var now = new Date();
            var folderName = escape(prependName + '-' + now.toISOString().slice(0,7));
            gdrive.files.list({
                q:
                    'mimeType = \'application/vnd.google-apps.folder\' and ' +
                    'name = \'' + folderName + '\' and ' +
                    '\'' + options.google.folderId + '\' in  parents'
            }, (err, response) => {
                if (err) return reject(err);
                if (response.files.length > 0)  return resolve(response.files[0].id);
                gdrive.files.create({
                    resource: {
                        name: folderName,
                        mimeType: 'application/vnd.google-apps.folder',
                        parents: [options.google.folderId]
                    },
                }, (err, response) => {
                    if (err) return reject(err);
                    return resolve(response.id);
                })
            });
        })
    }
}
