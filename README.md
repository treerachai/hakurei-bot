# Hakurei Bot

Discord Bot for a Brazilian Touhou Community

### Installation

This project uses NodeJS, to install it you can clone the repository then use npm to install its dependencies:

```sh
git clone https://github.com/enebe-nb/hakurei-bot.git
cd hakurei-bot
npm install
```

Or you can install it globally using:

```sh
npm install -g https://github.com/enebe-nb/hakurei-bot.git
```

### Usage

Form local installation you can use the `cli.js` script. Otherwise this script is installed with `hakurei-bot` name. The command syntax is:

```text
Usage:
  hakurei-bot [--<key>=<value>]... <config-file>...

Options:
  --<key>=<value>  Replace config file <key> option with <value>.

Example:
  hakurei-bot --auth.token=MY_DISCORD_TOKEN options.json
```

See {@link Options}
