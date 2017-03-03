'use strict';
const fs = require('fs');
const request = require('request');
const gapi = require('googleapis');
const gdrive = gapi.drive('v3');

module.exports =
class Google {
    constructor(services, options) {
        this.data_dir = options && options.data_dir || '.';
        this.folderId = options && options.folderId;
        this.gauth = new gapi.auth.OAuth2(
            options.clientId,
            options.clientSecret,
            'http://' + options.server_hostname + options.redirectPath
        )

        if (!this.loadCredentials()){
            console.log('Credentials Couldn\'t be loaded. Access the following link to reset Credentials.');
            console.log(this.generateAuthUrl());
        }

        services.express.get(options.redirectPath, (req, res) => { this.onServerRequest(req, res) });
        services.events.on('google.save', this.onSave, this);
        services.events.on('command.googleUrl', this.onGoogleUrl, this);
    }

    onGoogleUrl(id, message, argv) {
        message.channel.createMessage(this.generateAuthUrl());
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
        this.gauth.getToken(req.query.code, (err, credentials) => {
            if (err) return console.log(err);
            fs.writeFile(this.data_dir + '/gauth.json', JSON.stringify(credentials));
            this.gauth.setCredentials(credentials);
            gapi.options({auth: this.gauth});
            console.log('Google credentials renewed.');
            res.render('index',{});
        });
    }

    generateAuthUrl() {
        return this.gauth.generateAuthUrl({
            access_type: 'offline',
            scope: 'https://www.googleapis.com/auth/drive'
        });
    }

    loadCredentials() {
        try {
            var credentials = JSON.parse(fs.readFileSync(this.data_dir + '/gauth.json'));
            this.gauth.setCredentials(credentials);
            gapi.options({auth: this.gauth});
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
                    '\'' + this.folderId + '\' in  parents'
            }, (err, response) => {
                if (err) return reject(err);
                if (response.files.length > 0)  return resolve(response.files[0].id);
                gdrive.files.create({
                    resource: {
                        name: folderName,
                        mimeType: 'application/vnd.google-apps.folder',
                        parents: [this.folderId]
                    },
                }, (err, response) => {
                    if (err) return reject(err);
                    return resolve(response.id);
                })
            });
        })
    }
}
