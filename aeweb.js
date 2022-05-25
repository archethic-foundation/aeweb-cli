#!/usr/bin/env node

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import about from './commands/about.js'
import generate_address from './commands/generate_address.js'
import deploy from './commands/deploy.js'

const y = yargs(hideBin(process.argv))

y.command(about).help()
y.command(generate_address).help()
y.command(deploy).help()

y.parse()