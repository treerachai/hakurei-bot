'use strict';
const fs = require('fs');
const request = require('request');
const gapi = require('googleapis');
const gdrive = gapi.drive('v3');

/**
 * Load a file url and send it to Google Drive.
 *
 * @memberof Events
 * @event "google.save"
 * @param {string} url - File url
 * @param {string} prependName - Name to be prepended to group folder name
 */

module.exports =
/**
 * Google API interface.
 *
 * Receive Events:
 * - {@link Events.event:"google.save"}: Save file url to Google Drive
 *
 * @constructor Module.Google
 * @param {ServiceGroup} services - Service instances
 * @param {Object} options - Module options
 * @param {string} options.clientId - Google Application Id
 * @param {string} options.clientSecret - Google Application Secret
 * @param {string} options.folderId - Root folder id for GoogleDrive operations.
 * @param {string} options.redirectPath - Path on server to reset authentication.
 */
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
        services.events.on('command.googleurl', this.onGoogleUrl, this);
    }

    /**
     * Handle `googleurl` commands events
     * @method Module.Google#onGoogleUrl
     * @listens Events.event:"command.&lt;commandName&gt;"
     */
    onGoogleUrl(id, message, argv) {
        message.channel.createMessage(this.generateAuthUrl());
    }

    /**
     * Handle `google.save` events
     * @method Module.Google#onSave
     * @listens Events.event:"google.save"
     */
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
        });
    }

    /**
     * Callback to receive express request to `redirectPath`. See {@link http://expressjs.com/en/4x/api.html#app.get}
     * @method Module.Google#onServerRequest
     * @param req - See {@link http://expressjs.com/en/4x/api.html#req}
     * @param res - See {@link http://expressjs.com/en/4x/api.html#res}
     */
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

    /**
     * Get Google authentication url.
     *
     * @method Module.Google#generateAuthUrl
     * @return {string} Google authentication url
     */
    generateAuthUrl() {
        return this.gauth.generateAuthUrl({
            access_type: 'offline',
            scope: 'https://www.googleapis.com/auth/drive'
        });
    }

    /**
     * Load google credentials from storage
     *
     * @method Module.Google#loadCredetials
     * @return {boolean} True on successful loaded
     */
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

    /**
     * Retrieve Google the group folder id. If folder don't exists then create it.
     *
     * @method Module.Google#fetchGroupFolder
     * @param {string} prependName - Name to be prepended to group folder name
     * @return {Promise<string>}
     */
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
