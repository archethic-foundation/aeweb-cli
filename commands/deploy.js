
import Archethic, { Crypto, Utils } from 'archethic'
import chalk from 'chalk';
import yesno from 'yesno';
import { exit } from 'process';
import * as cli from './cli.js'
import AEWeb from '../lib/api.js';
import PathLib from 'path'
import fetch from "cross-fetch"

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
    alias: 's',
  },
  endpoint: {
    describe:
      'Endpoint is the URL of a welcome node to receive the transaction',
    demandOption: true, // Required
    type: 'string',
    alias: 'e',
  },
  path: {
    describe: 'Path to the folder or the file to deploy',
    demandOption: true, // Required
    type: 'string',
    alias: 'p',
  },
  "include-git-ignored-files": {
    describe: 'Upload files referenced in .gitignore',
    demandOption: false,
    type: 'boolean',
    alias: "i"
  },
  "ssl-certificate": {
    describe: 'SSL certificate to link to the website',
    demandOption: false,
    type: 'string',
    alias: "C"
  },
  "ssl-key": {
    describe: 'SSL key to certify the website',
    demandOption: false,
    type: 'string',
    alias: "K"
  }
};

const handler = async function(argv) {
  try {
    var isWebsiteUpdate = false, prevRefTxContent = undefined, transactions = [];
    // Get ssl configuration
    const {
      cert: sslCertificate,
      key: sslKey
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
    const endpoint = new URL(argv.endpoint).origin

    console.log(`Connecting to ${endpoint}`)

    const archethic = await new Archethic(endpoint).connect()

    // Get indexes
    const baseIndex = await archethic.transaction.getTransactionIndex(baseAddress)
    const refIndex = await archethic.transaction.getTransactionIndex(refAddress)
    let filesIndex = await archethic.transaction.getTransactionIndex(filesAddress)

    // Check if website is already deployed
    if ((refIndex) !== 0) {
      isWebsiteUpdate = true;
      const lastRefTx = await fetchLastRefTx(refAddress, archethic.nearestEndpoints[0]);
      prevRefTxContent = JSON.parse(lastRefTx.data.content);
    }

    // Convert directory structure into array of file content
    console.log(chalk.blue('Creating file structure and compress content...'))

    const aeweb = new AEWeb(archethic, prevRefTxContent)
    const files = cli.getFiles(folderPath, includeGitIgnoredFiles)

    if (files.length === 0) throw 'folder "' + PathLib.basename(folderPath) + '" is empty'

    files.forEach(({ filePath, data }) => aeweb.addFile(filePath, data))

    if (isWebsiteUpdate) await logUpdateInfo(aeweb)

    // Create transaction
    console.log(chalk.blue('Creating transactions ...'))

    if (!isWebsiteUpdate || (aeweb.listModifiedFiles().length)) {
      // when files changes does exist

      transactions = aeweb.getFilesTransactions()

      // Sign files transactions
      transactions = transactions.map(tx => {
        const index = filesIndex
        filesIndex++
        return tx.build(filesSeed, index).originSign(originPrivateKey)
      })
    }

    aeweb.addSSLCertificate(sslCertificate, sslKey)
    const refTx = await aeweb.getRefTransaction(transactions);

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

    // handle no new files tx, but update to ref tx
    if (filesTxFees) transferTx.addUCOTransfer(filesAddress, filesTxFees)

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


async function fetchLastRefTx(txnAddress, endpoint) {
  if (typeof txnAddress !== "string" && !(txnAddress instanceof Uint8Array)) {
    throw "'address' must be a string or Uint8Array";
  }

  if (typeof txnAddress == "string") {
    if (!isHex(txnAddress)) {
      throw "'address' must be in hexadecimal form if it's string";
    }
  }

  if (txnAddress instanceof Uint8Array) {
    txnAddress = uint8ArrayToHex(txnAddress);
  }
  const url = new URL("/api", endpoint);
  const query =
    `query {
                lastTransaction(
                    address: "${txnAddress}"
                    ){
                        data{
                                content
                            }
                    }
            }`

  return fetch(url,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body:
        JSON.stringify({
          query
        })
    })
    .then(handleResponse)
    .then(({
      data: { lastTransaction: data }
    }) => {
      return data;
    })
}

function handleResponse(response) {
  return new Promise(function(resolve, reject) {
    if (response.status >= 200 && response.status <= 299) {
      response.json().then(resolve);
    } else {
      reject(response.statusText);
    }
  });
}

async function logUpdateInfo(aeweb) {

  let modifiedFiles = aeweb.listModifiedFiles();
  let removedFiles = aeweb.listRemovedFiles();

  if (!modifiedFiles.length && !removedFiles.length) { throw 'No files to update' }

  console.log(
    chalk.greenBright
      (`
            Found ${modifiedFiles.length} New/Modified files 
            Found ${removedFiles.length} Removed files
      `));

  if (await yesno({
    question: chalk.yellowBright('Do you want to List Changes. (yes/no)'
    ),
  })) {
    console.log(chalk.blue('New/Modified files:'))
    modifiedFiles.forEach((file_path) => { console.log(chalk.green(`     ${file_path}`)) })

    console.log(chalk.blue('Removed files:'))
    removedFiles.forEach((file_path) => { console.log(chalk.red(`     ${file_path}     `)) })
  }
}

export default {
  command,
  describe,
  builder,
  handler
}
