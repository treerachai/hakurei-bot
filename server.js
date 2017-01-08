'use strict';

require('./lib/Options')({'': [(process.env.MAFIA_DATA_DIR || process.env.OPENSHIFT_DATA_DIR || './data') + '/options.json']});
new (require('./lib/Server'))();
new (require('./lib/Client'))();
