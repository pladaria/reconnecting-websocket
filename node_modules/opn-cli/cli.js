#!/usr/bin/env node
'use strict';
const meow = require('meow');
const opn = require('opn');
const getStdin = require('get-stdin');
const tempWrite = require('temp-write');
const fileType = require('file-type');

const cli = meow(`
	Usage
	  $ opn <file|url> [--wait] [-- <app> [args]]
	  $ cat <file> | opn [--wait] [--ext] [-- <app> [args]]

	Options
	  --wait  Wait for the app to exit
	  --ext   File extension for when stdin file type can't be detected

	Examples
	  $ opn http://sindresorhus.com
	  $ opn http://sindresorhus.com -- firefox
	  $ opn http://sindresorhus.com -- 'google chrome' --incognito
	  $ opn unicorn.png
	  $ cat unicorn.png | opn
	  $ echo '<h1>Unicorns!</h1>' | opn --ext=html
`, {
	default: {
		wait: false
	}
});

cli.flags.app = cli.input.slice(1);

const input = cli.input[0];

if (!input && process.stdin.isTTY) {
	console.error('Specify a filepath or URL');
	process.exit(1);
}

if (input) {
	opn(input, cli.flags);
} else {
	getStdin.buffer().then(stdin => {
		const type = fileType(stdin);
		const ext = (cli.flags.ext || type && type.ext || 'txt');
		opn(tempWrite.sync(stdin, `opn.${ext}`), cli.flags);
	});
}
