import fs from 'fs';
import Archethic, { Crypto, Utils } from 'archethic';
import chalk from 'chalk';
import path from 'path';
import yesno from 'yesno';
import zlib from 'zlib'
import { exit } from 'process';
import set from 'lodash/set.js'

const { deriveAddress, aesEncrypt, ecEncrypt, randomSecretKey } = Crypto
const { originPrivateKey, fromBigInt, uint8ArrayToHex } = Utils

const MAX_CONTENT_SIZE = 3_145_728
const MAX_FILE_SIZE = MAX_CONTENT_SIZE - 45_728 /* 45_728 represent json tree size */

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

const handler = async function (argv) {
  try {
    
    // Derive address and get last transaction index
    const endpoint = argv.endpoint

    //Initialize Archethic instance and start connection of the network
    const archethic = new Archethic(endpoint)
    console.log(`Connecting to ${endpoint}`)
    await archethic.connect()

    let folderPath = path.normalize(argv.path.endsWith(path.sep) ? argv.path.slice(0, -1) : argv.path)

    // Load ssl files
    const sslCertificateFile = argv["ssl-certificate"]
    const sslKeyFile = argv["ssl-key"]

    let sslConfiguration = {}

    if (sslCertificateFile !== undefined) {
      sslConfiguration.cert = fs.readFileSync(sslCertificateFile, "utf8")
    }

    if (sslKeyFile !== undefined) {
      sslConfiguration.key = fs.readFileSync(sslKeyFile, "utf8")
    }
    
    const baseSeed = argv.seed
    const baseAddress = deriveAddress(baseSeed, 0)
    const baseIndex = await archethic.transaction.getTransactionIndex(baseAddress)

    const refSeed = baseSeed + 'aeweb_ref'
    const firstRefAddress = deriveAddress(refSeed, 0)
    const refIndex = await archethic.transaction.getTransactionIndex(firstRefAddress)

    const filesSeed = baseSeed + 'aeweb_files'
    const firstFilesAdress = deriveAddress(filesSeed, 0)
    let filesIndex = await archethic.transaction.getTransactionIndex(firstFilesAdress)

    // Convert directory structure into array of file content
    console.log(chalk.blue('Creating file structure and compress content...'))

    let argStats
    const files = []
    try {
      argStats = fs.statSync(folderPath)
      if (argStats.isDirectory()) {
        handleDirectory(folderPath, files)
      } else {
        handleFile(folderPath, files)
        folderPath = path.dirname(folderPath)
      }

      if (files.length === 0) {
        throw { message: 'Folder ' + folderPath + ' is empty' }
      }
    } catch (e) {
      throw e
    }

    // Control size of json content
    console.log(chalk.blue('Spliting file(s) content in multiple transaction if necessary, it may take a while... ...'))

    let transactions = []

    const buildTx = (index, content) => {
      transactions.push(
        new Promise(async (resolve, reject) => {
          const tx = archethic.transaction.new()
            .setType('hosting')
            .setContent(JSON.stringify(content))
            .build(filesSeed, index)
            .originSign(originPrivateKey)

          const { fee }  = await archethic.transaction.getTransactionFee(tx)

          resolve({ tx, fee })
        })
      )
    }

    const refContent = {}

    if (sslConfiguration.cert !== undefined) {
      refContent.sslCertificate = sslConfiguration.cert
    }

    files.sort((a, b) => b.size - a.size)
    // Loop until all files are stored inside a transaction content
    while (files.length > 0) {
      // Get next tx address
      let txAddress = deriveAddress(filesSeed, filesIndex + 1)

      let txContent = {}
      let txContentSize = 0
      let file = {}
      // Loop over files to create a content of Max size
      // Create a transaction when there is no more file to fill the current tx content
      while (file) {
        // Take the first file that can fill the content or the first file if content is empty
        file = txContentSize == 0 ? (
          files[0]
        ) : (
          files.find(elt => (txContentSize + elt.size) <= MAX_FILE_SIZE)
        )

        if (file) {
          // Create json file path
          const tab_path = file.path.replace(folderPath, '').split(path.sep)
          if (tab_path[0] === '') { tab_path.shift() }
          let content = file.content
          const refFileContent = {
            encodage: file.encodage,
            address: []
          }

          // Handle file over than Max size. The file is splited in multiple transactions,
          // firsts parts take a full transaction, the last part follow the normal sized file construction
          while (content.length > MAX_FILE_SIZE) {
            // Split the file
            const part = content.slice(0, MAX_FILE_SIZE)
            content = content.replace(part, '')
            // Set the value in txContent
            set(txContent, tab_path, part)
            // Update refContent to refer value at txAddress
            refFileContent.address.push(uint8ArrayToHex(txAddress))
            set(refContent, tab_path, refFileContent)
            // Set the new size of the file
            file.size -= MAX_FILE_SIZE
            // Create new transaction
            buildTx(filesIndex, txContent)
            // Increment filesIndex for next transaction
            filesIndex++
            txAddress = deriveAddress(filesSeed, filesIndex + 1)
            txContent = {}
          }

          // Set the value in txContent
          set(txContent, tab_path, content)
          // Update refContent to refer value at txAddress
          refFileContent.address.push(uint8ArrayToHex(txAddress))
          set(refContent, tab_path, refFileContent)
          // Remove file from files
          files.splice(files.indexOf(file), 1)
          // Set the new size of txContent
          txContentSize += file.size
        }
      }

      // Create new transaction
      buildTx(filesIndex, txContent)

      // Increment filesIndex for next transaction
      filesIndex++
    }

    // Create transaction
    console.log(chalk.blue('Creating transactions and estimating fees ...'))

    const refTx = archethic.transaction.new()
      .setType('hosting')
      .setContent(JSON.stringify(refContent))

    if (sslConfiguration.key !== undefined) {
      const storageNoncePublicKey = await archethic.network.getStorageNoncePublicKey()
      const aesKey = randomSecretKey()
      const encryptedSecretKey = ecEncrypt(aesKey, storageNoncePublicKey)
      const encryptedSslKey = aesEncrypt(sslConfiguration.key, aesKey)

      refTx.addOwnership(encryptedSslKey, [{ publicKey: storageNoncePublicKey, encryptedSecretKey: encryptedSecretKey }])
    }

    refTx
      .build(refSeed, refIndex)
      .originSign(originPrivateKey)

    transactions = await Promise.all(transactions)

    // Estimate refTx fees
    const slippage = 1.01

    const { fee: fee, rates: rates } = await archethic.transaction.getTransactionFee(refTx)
    const refTxFees = Math.ceil(fee * slippage)

    let filesTxFees = 0

    transactions = transactions.map(elt => {
      filesTxFees += elt.fee
      return elt.tx
    })

    filesTxFees = Math.ceil(filesTxFees * slippage)

    // Create transfer transactions
    const transferTx = archethic.transaction.new()
      .setType("transfer")
      .addUCOTransfer(firstRefAddress, fromBigInt(refTxFees))
      .addUCOTransfer(firstFilesAdress, fromBigInt(filesTxFees))
      .build(baseSeed, baseIndex)
      .originSign(originPrivateKey)

    let fees = refTxFees + filesTxFees
    fees += (await archethic.transaction.getTransactionFee(transferTx)).fee

    transactions.unshift(transferTx)
    transactions.push(refTx)

    fees = fromBigInt(fees)

    console.log(chalk.yellowBright(
      'Total Fee Requirement would be : ' +
      fees +
      ' UCO ( $ ' +
      (rates.usd * fees).toFixed(2) +
      ' | € ' +
      (rates.eur * fees).toFixed(2) +
      '), for ' + transactions.length + ' transactions.'
    ))

    const ok = await yesno({
      question: chalk.yellowBright(
        'Do you want to continue. (yes/no)'
      ),
    });

    if (ok) {
      console.log(chalk.blue('Sending ' + transactions.length + ' transactions...'))

     await sendTransactions(transactions, 0, endpoint)
       .then(() => {
         console.log(
           chalk.green(
             (argStats.isDirectory() ? 'Website' : 'File') + ' is deployed at:',
             endpoint + '/api/web_hosting/' + uint8ArrayToHex(firstRefAddress) + '/'
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

function handleFile(file, files) {
  const data = fs.readFileSync(file)
  const content = zlib.gzipSync(data).toString('base64url')
  files.push({
    path: file,
    size: content.length,
    content,
    encodage: 'gzip'
  })
}

function handleDirectory(entry, files) {
  const stats = fs.statSync(entry)

  if (stats.isDirectory()) {
    fs.readdirSync(entry).forEach(child => {
      handleDirectory(entry + path.sep + child, files)
    });
  } else {
    handleFile(entry, files)
  }
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
