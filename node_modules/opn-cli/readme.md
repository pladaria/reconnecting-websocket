# opn-cli [![Build Status](https://travis-ci.org/sindresorhus/opn-cli.svg?branch=master)](https://travis-ci.org/sindresorhus/opn-cli)

> A better [node-open](https://github.com/pwnall/node-open). Opens stuff like websites, files, executables. Cross-platform.


## Install

```
$ npm install --global opn-cli
```


## Usage

```
$ opn --help

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
```

The [following file types](https://github.com/sindresorhus/file-type#supported-file-types) are automagically detected when using stdin mode.


## Related

- [opn](https://github.com/sindresorhus/opn) - API for this module


## License

MIT © [Sindre Sorhus](http://sindresorhus.com)
