'use strict';

var options = require('./lib/Options')({'': [(process.env.MAFIA_DATA_DIR || process.env.OPENSHIFT_DATA_DIR || './data') + '/options.json']});
require('./lib/Services')(options);
