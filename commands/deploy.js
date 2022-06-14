import fs from 'fs';
import archethic from 'archethic';
import chalk from 'chalk';
import path from 'path';
import yesno from 'yesno';
import zlib from 'zlib'
import { exit } from 'process';
import get from 'lodash/get.js'
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
    const seed = argv.seed
    const endpoint = argv.endpoint
    const firstAddress = archethic.deriveAddress(seed, 0)
    let index = await archethic.getTransactionIndex(firstAddress, endpoint)

    // Convert directory structure to json
    console.log(chalk.blue('Creating file structure and compress content...'))

    let main_json = {}
    let argStats
    let files_size = []
    try {
      argStats = fs.statSync(argv.path)
      if (argStats.isDirectory()) {
        main_json = handleDirectory(argv.path, files_size)
      } else {
        main_json[path.basename(argv.path)] = handleFile(argv.path, files_size)
      }

      if (Object.keys(main_json).length === 0) {
        throw { message: 'Folder ' + argv.path + ' is empty' }
      }
    } catch (e) {
      throw e.message
    }

    // Control size of json content
    console.log(chalk.blue('Spliting file(s) content in multiple transaction if necessary ...'))

    let transactions = []
    files_size.sort((a, b) => b.size - a.size)
    // While the main json content is over the max size we create new transaction to split content
    let main_json_size = JSON.stringify(main_json).length
    while (main_json_size > MAX_CONTENT_SIZE) {
      // Get next tx address
      let tx_address = archethic.deriveAddress(seed, index + 1)

      let tx_content = {}
      let tx_content_size = 0
      let file = {}
      // Loop over files to create a content of Max size
      // Create a transaction when the main_json_file is under the Max size
      // or when there is no more file to fill the current tx content
      while (main_json_size > MAX_CONTENT_SIZE && file) {
        // Take the first file that can fill the content or the first file if content is empty
        file = tx_content_size == 0 ? (
          files_size[0]
        ) : (
          files_size.find(elt => (tx_content_size + elt.size) <= MAX_FILE_SIZE)
        )

        if (file) {
          // Retrieve json file path
          const tab_path = file.path.replace(argv.path, '').split(path.sep)
          if (tab_path[0] === '') { tab_path.shift() }
          // Get file content in main_json
          const main_file = get(main_json, tab_path)
          let content = main_file.content
          main_file.content = []

          // Handle file over than Max size. The file is splited in multiple transactions,
          // firsts parts take a full transaction, the last part follow the normal sized file construction
          while (content.length > MAX_FILE_SIZE) {
            // Split the file
            const part = content.slice(0, MAX_FILE_SIZE)
            content = content.replace(part, '')
            // Set the value in tx_content
            set(tx_content, tab_path, part)
            // Update main_json to refer value at tx_address
            main_file.content.push(tx_address)
            set(main_json, tab_path, main_file)
            // Set the new size of main_json
            main_json_size -= MAX_FILE_SIZE
            file.size -= MAX_FILE_SIZE
            // Insert content for new transaction
            transactions.push({ index, tx_content })
            // Increment index for next transaction
            index++
            tx_address = archethic.deriveAddress(seed, index + 1)
            tx_content = {}
          }

          // Set the value in tx_content
          set(tx_content, tab_path, content)
          // Update main_json to refer value at tx_address
          main_file.content.push(tx_address)
          set(main_json, tab_path, main_file)
          // Remove file from files_size
          files_size.splice(files_size.indexOf(file), 1)
          // Set the new size of tx_content
          tx_content_size += file.size
          // Set the new size of main_json
          main_json_size -= file.size + JSON.stringify(main_file.content).length
        }
      }

      // Insert content for new transaction
      transactions.push({ index, tx_content })

      // Increment index for next transaction
      index++
    }

    // Add main_json content in array
    transactions.push({ index, tx_content: main_json })

    // Create transaction
    console.log(chalk.blue('Creating transaction(s), it may take a while...'))

    const originPrivateKey = archethic.getOriginKey()

    transactions = transactions.map(elt => {
      return archethic.newTransactionBuilder('hosting')
        .setContent(JSON.stringify(elt.tx_content))
        .build(seed, elt.index)
        .originSign(originPrivateKey)
    })

    // Get transaction fees and ask user
    console.log(chalk.blue('Estimating fees...'))

    let fees = 0
    let rates
    for (const tx of transactions) {
      const { fee: fee, rates: rate } = await archethic.getTransactionFee(tx, endpoint)
      fees += fee
      rates = rate
    }

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
      console.log(chalk.blue('Sending ' + transactions.length + ' transaction...'))

      sendTransaction(transactions, 0, endpoint)
        .then(() => {
          console.log(
            chalk.green(
              (argStats.isDirectory() ? 'Website' : 'File') + ' is deployed at:',
              endpoint + '/api/web_hosting/' + firstAddress + '/'
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

function handleFile(file, files_size) {
  const data = fs.readFileSync(file)
  const content = zlib.gzipSync(data).toString('base64url')
  files_size.push({
    path: file,
    size: content.length
  })
  return {
    encodage: 'gzip',
    content
  }
}

function handleDirectory(entry, files_size) {
  const stats = fs.statSync(entry)
  let json = {}

  if (stats.isDirectory()) {
    fs.readdirSync(entry).forEach(child => {
      json[path.basename(child)] = handleDirectory(entry + '/' + child, files_size)
    });
  } else {
    json = handleFile(entry, files_size)
  }

  return json;
}

async function sendTransaction(transactions, index, endpoint) {
  return new Promise(async (resolve, reject) => {
    console.log(chalk.blue('Transaction ' + (index + 1) + '...'))
    const tx = transactions[index]

    await archethic.waitConfirmations(
      tx.address,
      endpoint,
      async nbConfirmations => {
        console.log(chalk.blue('Got ' + nbConfirmations + ' confirmations'))
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