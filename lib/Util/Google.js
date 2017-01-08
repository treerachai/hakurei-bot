'use strict';
const options = require('../Options')();
const request = require('request');
const mime = require('mime');
const gapi = require('googleapis');
const gauth = new gapi.auth.OAuth2(
    options.google.clientId,
    options.google.clientSecret,
    options.google.redirectUrl
);

const gdrive = gapi.drive('v3');

const scopes = [
    'https://www.googleapis.com/auth/drive',
];

gauth.setCredentials(options.google.token);
gapi.options({auth: gauth});

module.exports = {
    saveToDrive(url) {
        console.log('Saving');
        request(url, (error, response, body) => {
            gdrive.files.create({
                media: {
                    body: request(url),
                }
            }, console.log)
        });
    }
}
