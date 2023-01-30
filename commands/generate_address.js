import { Crypto, Utils } from 'archethic'
import chalk from 'chalk'

const command = 'generate-address'

const describe = 'Generate Address - to transfer some funds to this address'

const builder = {
  seed: {
    describe: 'Seed is a string representing the transaction chain entropy to be able to derive and generate the keys for the transactions',
    demandOption: true, // Required
    type: 'string',
    alias: 's'
  },
  index: {
    describe: 'Index is the number of transactions in the chain, to generate the current and the next public key',
    demandOption: true, // Required
    type: 'number',
    alias: 'i'
  }
}

const handler = function (argv) {
  const address = Crypto.deriveAddress(argv.seed, argv.index)
  console.log(chalk.blue(Utils.uint8ArrayToHex(address)))
  console.log(chalk.green("If you are using testnet go to https://testnet.archethic.net/faucet & add some funds to the generated address, otherwise transfer funds from your UCO wallet (in Mainnet)"))
}

export default {
  command,
  describe,
  builder,
  handler
}
