
import Archethic, { Crypto, Utils } from 'archethic'
import chalk from 'chalk';
import yesno from 'yesno';
import { exit } from 'process';
import * as cli from './cli.js'
import AEWeb from '../lib/api.js';
import path from 'path'

const { deriveAddress } = Crypto
const { originPrivateKey, fromBigInt, uint8ArrayToHex } = Utils

const command = 'deploy';

const describe =
  'Deploy a single file or all file inside a folder';

const builder = {
  seed: {
    describe:
      'Seed is a string representing the transaction chain entropy to be able to derive and generate the keys for the transactions',
    demandOption: true, // Required
    type: 'string',
  },

  endpoint: {
    describe:
      'Endpoint is the URL of a welcome node to receive the transaction',
    demandOption: true, // Required
    type: 'string',
  },

  path: {
    describe: 'Path to the folder or the file to deploy',
    demandOption: true, // Required
    type: 'string',
  },
  "include-git-ignored-files": {
    describe: 'Upload files referenced in .gitignore',
    demandOption: false,
    type: 'boolean',
  },
  "ssl-certificate": {
    describe: 'SSL certificate to link to the website',
    demandOption: false,
    type: 'string'
  },
  "ssl-key": {
    describe: 'SSL key to certify the website',
    demandOption: false,
    type: 'string'
  }
};

const handler = async function(argv) {
  try {
    // Get ssl configuration
    const {
      sslCertificate,
      sslKey
    } = cli.loadSSL(argv['ssl-certificate'], argv['ssl-key'])

    // Should include git ignored files
    const includeGitIgnoredFiles = argv['include-git-ignored-files']
    
    // Get the path
    const folderPath = cli.normalizeFolderPath(argv.path)

    // Get seeds
    const baseSeed = argv.seed
    const { refSeed, filesSeed } = cli.getSeeds(baseSeed)

    // Get genesis addresses
    const baseAddress = deriveAddress(baseSeed, 0)
    const refAddress = deriveAddress(refSeed, 0)
    const filesAddress = deriveAddress(filesSeed, 0)

    // Initialize endpoint connection
    // when given endpoint ends with "/" http://192.168.1.8:4000/ results in irregular links
    // bad link=> http://192.168.1.8:4000//api/web_hosting/address/
    // bad link=> http://192.168.1.8:4000//explorer/transaction/000
    const endpoint = new URL(argv.endpoint).origin

    console.log(`Connecting to ${endpoint}`)

    const archethic = await new Archethic(endpoint).connect()

    // Get indexes
    const baseIndex = await archethic.transaction.getTransactionIndex(baseAddress)
    const refIndex = await archethic.transaction.getTransactionIndex(refAddress)
    let filesIndex = await archethic.transaction.getTransactionIndex(filesAddress)

    // Convert directory structure into array of file content
    console.log(chalk.blue('Creating file structure and compress content...'))

    const aeweb = new AEWeb(archethic)
    const files = cli.getFiles(folderPath, includeGitIgnoredFiles)

    if (files.length === 0) throw 'folder "' + path.basename(folderPath) + '" is empty'

    files.forEach(({ filePath, data }) => aeweb.addFile(filePath, data))

    // Create transaction
    console.log(chalk.blue('Creating transactions ...'))

    let transactions = aeweb.getFilesTransactions()

    // Sign files transactions
    transactions = transactions.map(tx => {
      const index = filesIndex
      filesIndex++
      return tx.build(filesSeed, index).originSign(originPrivateKey)
    })

    aeweb.addSSLCertificate(sslCertificate, sslKey)
    const refTx = await aeweb.getRefTransaction(transactions)

    // Sign ref transaction
    refTx.build(refSeed, refIndex).originSign(originPrivateKey)

    transactions.push(refTx)

    // Estimate fees
    console.log(chalk.blue('Estimating fees ...'))

    const { refTxFees, filesTxFees } = await cli.estimateTxsFees(archethic, transactions)

    // Create transfer transaction
    const transferTx = archethic.transaction.new()
      .setType('transfer')
      .addUCOTransfer(refAddress, refTxFees)
      .addUCOTransfer(filesAddress, filesTxFees)

    transferTx.build(baseSeed, baseIndex).originSign(originPrivateKey)

    transactions.unshift(transferTx)

    const { fee, rates } = await archethic.transaction.getTransactionFee(transferTx)

    const fees = fromBigInt(fee + refTxFees + filesTxFees)

    // Ask for fees validation
    const ok = await validFees(fees, rates, transactions.length)

    if (ok) {
      console.log(chalk.blue('Sending ' + transactions.length + ' transactions...'))

      await sendTransactions(transactions, 0, endpoint)
        .then(() => {
          console.log(
            chalk.green(
              'Website is deployed at:',
              endpoint + '/api/web_hosting/' + uint8ArrayToHex(refAddress) + '/'
            )
          )

          exit(0)
        })
        .catch(error => {
          console.log(
            chalk.red('Transaction validation error : ' + error)
          )

          exit(1)
        })
    } else {
      throw 'User aborted website deployment.'
    }
  } catch (e) {
    console.log(chalk.red(e))
    exit(1)
  }
}

async function validFees(fees, rates, nbTxs) {
  console.log(chalk.yellowBright(
    'Total Fee Requirement would be : ' +
    fees +
    ' UCO ( $ ' +
    (rates.usd * fees).toFixed(2) +
    ' | € ' +
    (rates.eur * fees).toFixed(2) +
    '), for ' + nbTxs + ' transactions.'
  ))

  return await yesno({
    question: chalk.yellowBright(
      'Do you want to continue. (yes/no)'
    ),
  })
}

async function sendTransactions(transactions, index, endpoint) {
  return new Promise(async (resolve, reject) => {
    console.log(chalk.blue('Transaction ' + (index + 1) + '...'))
    const tx = transactions[index]

    tx
      .on('requiredConfirmation', async (nbConf) => {
        console.log(chalk.blue('Transaction confirmed !'))
        console.log(
          chalk.cyanBright(
            'See transaction in explorer:',
            endpoint + '/explorer/transaction/' + uint8ArrayToHex(tx.address)
          )
        )
        console.log('-----------')

        if (index + 1 == transactions.length) {
          resolve()
        } else {
          sendTransactions(transactions, index + 1, endpoint)
            .then(() => resolve())
            .catch(error => reject(error))
        }
      })
      .on('error', (context, reason) => reject(reason))
      .on('timeout', (nbConf) => reject('Transaction fell in timeout'))
      .on('sent', () => console.log(chalk.blue('Waiting transaction validation...')))
      .send(75)
  })
}

export default {
  command,
  describe,
  builder,
  handler
}
