
import Archethic, { Crypto, Utils } from '@archethicjs/sdk'
import chalk from 'chalk';
import yesno from 'yesno';
import { exit } from 'process';
import * as cli from './cli.js'
import AEWeb from '../lib/api.js';
import PathLib from 'path'
import fetch from "cross-fetch"
import bip39 from "bip39";
import { getSeeds } from "./cli.js";

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
  "keychain-funding-service": {
    describe: 'Keychain funding service',
    demandOption: false,
    type: 'string',
    alias: 'k'
  },
  "keychain-website-service": {
    describe: 'Keychain funding service',
    demandOption: false,
    type: 'string',
    alias: 'w'
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



    // Initialize endpoint connection
    const endpoint = new URL(argv.endpoint).origin

    console.log(chalk.blue(`Connecting to ${endpoint}`))

    const archethic = await new Archethic(endpoint).connect()

    // Get base seed
    const baseSeed = argv.seed

    let keychain;
    let keychainFundingService = argv['keychain-funding-service']
    let keychainWebsiteService = argv['keychain-website-service']

    if (keychainFundingService) {
      let keychainSeed = baseSeed;
      if(bip39.validateMnemonic(keychainSeed)) {
        console.log(chalk.blue("Validate mnemonic"))
        keychainSeed = bip39.mnemonicToEntropy(keychainSeed);
      }

      console.log(chalk.blue("Fetching keychain..."))
      keychain = await archethic.account.getKeychain(keychainSeed);
      if (!keychain.services[keychainFundingService]) {
        throw `The keychain doesn't include the ${keychainFundingService} service`
      }

      if (!keychain.services[keychainWebsiteService]) {
        throw `The keychain doesn't include the ${keychainWebsiteService} service`
      }

      console.log(chalk.blue("Keychain loaded with the funding/website services"))
    }

    let baseAddress, refAddress, filesAddress
    let refSeed, filesSeed

    if (keychain) {
      baseAddress = keychain.deriveAddress(keychainFundingService, 0)
      refAddress = keychain.deriveAddress(keychainWebsiteService, 0)
      filesAddress = keychain.deriveAddress(keychainWebsiteService, 0, "files")
    } else {
      // Get seeds
      const extendedSeeds = getSeeds(baseSeed)
      refSeed = extendedSeeds.refSeed
      filesSeed = extendedSeeds.filesSeed

      // Get genesis addresses
      baseAddress = deriveAddress(baseSeed, 0)
      refAddress = deriveAddress(refSeed, 0)
      filesAddress = deriveAddress(filesSeed, 0)
    }

    // Get indexes
    const baseIndex = await archethic.transaction.getTransactionIndex(baseAddress)
    const refIndex = await archethic.transaction.getTransactionIndex(refAddress)
    let filesIndex = await archethic.transaction.getTransactionIndex(filesAddress)

    // Check if website is already deployed
    if (refIndex !== 0) {
      console.log(archethic.nearestEndpoints)
      const lastRefTx = await fetchLastRefTx(refAddress, archethic);
      try{
        prevRefTxContent = JSON.parse(lastRefTx.data.content);
        isWebsiteUpdate = true;
      } catch (e){
        console.warn('No existing transaction found on refAddress for hosting the website. This will be considered as the initial hosting transaction.');
      }
    }

    // Convert directory structure into array of file content
    console.log(chalk.blue('Creating file structure and compress content...'))

    const aeweb = new AEWeb(archethic, prevRefTxContent)
    const files = cli.getFiles(folderPath, includeGitIgnoredFiles)

    if (files.length === 0) {
      throw 'folder "' + PathLib.basename(folderPath) + '" is empty'
    }

    files.forEach(({ filePath, data }) => aeweb.addFile(filePath, data))

    if (isWebsiteUpdate) {
      await logUpdateInfo(aeweb)
    }

    // Create transaction
    console.log(chalk.blue('Creating transactions ...'))

    if (!isWebsiteUpdate || (aeweb.listModifiedFiles().length)) {
      // when files changes does exist

      transactions = aeweb.getFilesTransactions()

      // Sign files transactions
      transactions = transactions.map(tx => {
        const index = filesIndex
        filesIndex++
        if (keychain) {
          return keychain
              .buildTransaction(tx, keychainWebsiteService, index, "files")
              .originSign(originPrivateKey)
        }
        return tx.build(filesSeed, index).originSign(originPrivateKey)
      })
    }

    aeweb.addSSLCertificate(sslCertificate, sslKey)
    const refTx = await aeweb.getRefTransaction(transactions);

    if (keychain) {
      keychain
          .buildTransaction(refTx, keychainWebsiteService, refIndex)
          .originSign(originPrivateKey)
    } else {
      refTx
          .build(refSeed, refIndex)
          .originSign(originPrivateKey)
    }

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

    if (keychain) {
      keychain
          .buildTransaction(transferTx, keychainFundingService, baseIndex)
          .originSign(originPrivateKey)
    } else {
      transferTx
          .build(baseSeed, baseIndex)
          .originSign(originPrivateKey)
    }

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

  const feeStatus = `Total Fee Requirement would be: ${fees} UCO ($${(rates.usd * fees).toFixed(2)} | €${(rates.eur * fees).toFixed(2)})`
  console.log(chalk.yellowBright(feeStatus))

  const confirmation = {
    question: chalk.yellowBright(
      'Do you want to continue. (yes/no)'
    ),
  }
  
  return await yesno(confirmation)
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


async function fetchLastRefTx(txnAddress, archethic) {
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

  const query =`
  query {
    lastTransaction(
      address: "${txnAddress}"
      ){
        data{
          content
        }
      }
  }`

  return archethic.network.rawGraphQLQuery(query)
    .then(r => {
      if (r.lastTransaction) {
        return r.lastTransaction
      } 
    })
}

async function logUpdateInfo(aeweb) {

  let modifiedFiles = aeweb.listModifiedFiles();
  let removedFiles = aeweb.listRemovedFiles();

  if (!modifiedFiles.length && !removedFiles.length) { 
    throw 'No files to update'
  }

  const udpate_info = `
    Found ${modifiedFiles.length} New/Modified files 
    Found ${removedFiles.length} Removed files
  `

  console.log(chalk.greenBright(udpate_info));

  const confirmation_question = { question: chalk.yellowBright('Do you want to List Changes. (yes/no)') }
  if (await yesno(confirmation_question)) {
    console.log(chalk.blue('New/Modified files:'))
    modifiedFiles.forEach((file_path) => { console.log(chalk.green(`    ${file_path}`)) })

    console.log(chalk.blue('Removed files:'))
    removedFiles.forEach((file_path) => { console.log(chalk.red(`    ${file_path}`)) })
  }
}

export default {
  command,
  describe,
  builder,
  handler
}
