import fs from "fs";
import archethic from "archethic";
import chalk from "chalk";
import path from "path";
import yesno from "yesno";
import zlib from 'zlib'

const command = "deploy";

const describe =
  "Deploy a single file or all file inside a folder";

const builder = {
  seed: {
    describe:
      "Seed is a string representing the transaction chain entropy to be able to derive and generate the keys for the transactions",
    demandOption: true, // Required
    type: "string",
  },

  endpoint: {
    describe:
      "Endpoint is the URL of a welcome node to receive the transaction",
    demandOption: true, // Required
    type: "string",
  },

  path: {
    describe: "Path to the folder or the file to deploy",
    demandOption: true, // Required
    type: "string",
  },
};

const handler = async function (argv) {
  try {
    // Derive address and get last transaction index
    const seed = argv.seed
    const endpoint = argv.endpoint
    const firstAddress = archethic.deriveAddress(seed, 0)
    const index = await archethic.getTransactionIndex(firstAddress, endpoint)

    // Convert directory structure to json
    console.log(chalk.blue('Creating file structure and compress content...'))

    let json = {}
    try {
      const stats = fs.statSync(argv.path)
      if (stats.isDirectory()) {
        json = handleDirectory(argv.path)
      } else {
        json[path.basename(argv.folder)] = handleFile(argv.path)
      }

      if (Object.keys(json).length === 0) {
        throw { message: 'Folder ' + argv.path + ' is empty' }
      }
    } catch (e) {
      throw e.message
    }

    // Create transaction
    console.log(chalk.blue('Creating transaction, it may take a while...'))

    const tx = archethic.newTransactionBuilder('hosting')
      .setContent(JSON.stringify(json))
      .build(seed, index)
      .originSign(await archethic.getOriginKey(endpoint))

    // Get transaction fees and ask user
    const { fee: fees, rates: rates } = await archethic.getTransactionFee(tx, endpoint)

    const ok = await yesno({
      question: chalk.yellowBright(
        "Total Fee Requirement would be : " +
        fees.toFixed(2) +
        " UCO ( $ " +
        (rates.usd * fees).toFixed(2) +
        " | € " +
        (rates.eur * fees).toFixed(2) +
        " ). Do you want to continue. (yes/no)"
      ),
    });

    if (ok) {
      console.log(chalk.blue('Sending transaction...'))

      await archethic.waitConfirmations(
        tx.address,
        endpoint,
        nbConfirmations => {
          console.log(chalk.blue("Got " + nbConfirmations + " confirmations"))
          console.log(
            chalk.green(
              "Website is deployed at:",
              endpoint + "/api/web_hosting/" + firstAddress + '/'
            )
          )
        }
      )

      await archethic.sendTransaction(tx, endpoint)
      console.log(chalk.blue('Waiting transaction validation...'))
    } else {
      throw "User aborted website deployment."
    }
  } catch (e) {
    console.log(chalk.red(e))
  }
}

function handleFile(file) {
  const data = fs.readFileSync(file)
  return {
    encodage: 'gzip',
    content: zlib.gzipSync(data).toString('base64url')
  }
}

function handleDirectory(entry) {
  const stats = fs.statSync(entry)
  let json = {}

  if (stats.isDirectory()) {
    fs.readdirSync(entry).forEach(child => {
      json[path.basename(child)] = handleDirectory(entry + '/' + child)
    });
  } else {
    json = handleFile(entry)
  }

  return json;
}

export default {
  command,
  describe,
  builder,
  handler
}