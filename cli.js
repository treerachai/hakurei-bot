#!/usr/bin/env node

function parseArgs(argv) {
    var match, parsed = {};
    for (var arg of argv) {
        if (match = arg.match(/^--(no-)?([^=]+)(?:\=(.*))?/)) {
            parsed[match[2]] = match[3] ? match[3] : !match[1];
        } else {
            (parsed[''] = parsed[''] || []).push(arg);
        }
    }
    return parsed;
}

function expand(obj) {
    var stack = [obj];
    for (var i=0; i<stack.length; ++i) {
        for (var j in stack[i]) {
            if (j.indexOf('.') >= 0) {
                var k = j.split('.', 2);
                (stack[i][k[0]] = stack[i][k[0]] || {})[k[1]] = stack[i][j];
                delete stack[i][j];
                stack.push(stack[i][k[0]][k[1]])
            }
        }
    }
    return obj;
}

function printHelp() {
    var p = JSON.parse(require('fs').readFileSync('./package.json'));
    console.log(p.name + ' v' + p.version);
    console.log(p.description);
    console.log();
    console.log('Usage:');
    console.log('  hakurei-bot [--<key>=<value>]... <config-file>...');
    console.log();
    console.log('Options:');
    console.log('  --<key>=<value>  Replace config file <key> option with <value>.');
    console.log();
}

var args = parseArgs(process.argv.slice(2));
if (args['help']) {
    printHelp();
} else {
    require('./lib/Services')(require('./lib/Options')(expand(args)));
}
