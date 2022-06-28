import fs from 'fs';
import archethic from 'archethic';
import chalk from 'chalk';
import path from 'path';
import yesno from 'yesno';
import zlib from 'zlib'
import { exit } from 'process';
import set from 'lodash/set.js'

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
};

const handler = async function (argv) {
  try {
    // Derive address and get last transaction index
    const endpoint = argv.endpoint
    let folderPath = path.normalize(argv.path.endsWith(path.sep) ? argv.path.slice(0, -1) : argv.path)

    const baseSeed = argv.seed
    const baseIndex = await archethic.getTransactionIndex(archethic.deriveAddress(baseSeed, 0), endpoint)

    const refSeed = baseSeed + 'aeweb_ref'
    const firstRefAddress = archethic.deriveAddress(refSeed, 0)
    const refIndex = await archethic.getTransactionIndex(firstRefAddress, endpoint)

    const filesSeed = baseSeed + 'aeweb_files'
    const firstFilesAdress = archethic.deriveAddress(filesSeed, 0)
    let filesIndex = await archethic.getTransactionIndex(firstFilesAdress, endpoint)

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
      throw e.message
    }

    // Control size of json content
    console.log(chalk.blue('Spliting file(s) content in multiple transaction if necessary ...'))

    const refContent = {}
    let transactions = []
    files.sort((a, b) => b.size - a.size)
    // Loop until all files are stored inside a transaction content
    while (files.length > 0) {
      // Get next tx address
      let txAddress = archethic.deriveAddress(filesSeed, filesIndex + 1)

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
            refFileContent.address.push(txAddress)
            set(refContent, tab_path, refFileContent)
            // Set the new size of the file
            file.size -= MAX_FILE_SIZE
            // Insert content for new transaction
            transactions.push({ filesIndex, txContent })
            // Increment filesIndex for next transaction
            filesIndex++
            txAddress = archethic.deriveAddress(filesSeed, filesIndex + 1)
            txContent = {}
          }

          // Set the value in txContent
          set(txContent, tab_path, content)
          // Update refContent to refer value at txAddress
          refFileContent.address.push(txAddress)
          set(refContent, tab_path, refFileContent)
          // Remove file from files
          files.splice(files.indexOf(file), 1)
          // Set the new size of txContent
          txContentSize += file.size
        }
      }

      // Insert content for new transaction
      transactions.push({ filesIndex, txContent })

      // Increment filesIndex for next transaction
      filesIndex++
    }

    // Create transaction
    console.log(chalk.blue('Creating transactions, it may take a while...'))

    const originPrivateKey = archethic.getOriginKey()

    const refTx = archethic.newTransactionBuilder('hosting')
      .setContent(JSON.stringify(refContent))
      .build(refSeed, refIndex)
      .originSign(originPrivateKey)

    transactions = transactions.map((elt) => {
      return archethic.newTransactionBuilder('hosting')
        .setContent(JSON.stringify(elt.txContent))
        .build(filesSeed, elt.filesIndex)
        .originSign(originPrivateKey)
    })

    // Get transactions fees and ask user
    console.log(chalk.blue('Estimating fees...'))

    // Estimate refTx fees
    const slippage = 1.02

    let { fee: fee, rates: rates } = await archethic.getTransactionFee(refTx, endpoint)
    const refTxFees = +(fee * slippage).toFixed(8)

    let filesTxFees = 0
    // Estimate filesTx fees
    for (const tx of transactions) {
      ({ fee: fee } = await archethic.getTransactionFee(tx, endpoint))
      filesTxFees += +(fee * slippage).toFixed(8)
    }

    // Create transfer transactions
    const transferTx = archethic.newTransactionBuilder('transfer')
      .addUCOTransfer(firstRefAddress, refTxFees)
      .addUCOTransfer(firstFilesAdress, filesTxFees)
      .build(baseSeed, baseIndex)
      .originSign(originPrivateKey)

    let fees = refTxFees + filesTxFees
    fees += (await archethic.getTransactionFee(transferTx, endpoint)).fee

    transactions.unshift(transferTx)
    transactions.push(refTx)

    console.log(chalk.yellowBright(
      'Total Fee Requirement would be : ' +
      fees.toFixed(2) +
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

      await sendTransaction(transactions, 0, endpoint)
        .then(() => {
          // Send reference tx
          console.log(
            chalk.green(
              (argStats.isDirectory() ? 'Website' : 'File') + ' is deployed at:',
              endpoint + '/api/web_hosting/' + firstRefAddress + '/'
            )
          )

          exit(0)
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

async function sendTransaction(transactions, index, endpoint) {
  return new Promise(async (resolve, reject) => {
    console.log(chalk.blue('Transaction ' + (index + 1) + '...'))
    const tx = transactions[index]

    await archethic.waitConfirmations(
      tx.address,
      endpoint,
      async nbConfirmations => {
        if (nbConfirmations == 1) {
          console.log(chalk.blue('Got confirmation'))
          console.log(
            chalk.cyanBright(
              'See transaction in explorer:',
              endpoint + '/explorer/transaction/' + Buffer.from(tx.address).toString('hex')
            )
          )

          if (index + 1 == transactions.length) {
            resolve()
          } else {
            await sendTransaction(transactions, index + 1, endpoint)
            resolve()
          }
        }
      }
    )

    await archethic.sendTransaction(tx, endpoint)
    console.log(chalk.blue('Waiting transaction validation...'))
  })
}

export default {
  command,
  describe,
  builder,
  handler
}