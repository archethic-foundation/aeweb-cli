#!/usr/bin/env node

const yargs = require('yargs')

yargs.command(require('./commands/about'))
    .help()

yargs.command((require('./commands/generate_address')))
    .help()

yargs.command((require('./commands/deploy_file')))
    .help()

yargs.command((require('./commands/deploy_folder')))
    .help()

yargs.command((require('./commands/deploy_website')))
    .help()


yargs.parse()