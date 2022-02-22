const fs = require('fs')
const archethic = require('archethic')
const originPrivateKey = "01009280BDB84B8F8AEDBA205FE3552689964A5626EE2C60AA10E3BF22A91A036009"
const chalk = require('chalk')
const mime = require('mime')
let transaction
let send_file
let index

function toHex(bytes) {
    return bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '');
}

exports.command = 'deploy-file'

exports.describe = 'Deploy file on Archethic Public Blockchain'

exports.builder = {
    seed: {
        describe: 'Seed is a string representing the transaction chain entropy to be able to derive and generate the keys for the transactions',
        demandOption: true, // Required
        type: 'string'
    },

    endpoint: {
        describe: 'Endpoint is the URL of a welcome node to receive the transaction',
        demandOption: true, // Required
        type: 'string'
    },

    file: {
        describe: 'Path is the path of file',
        demandOption: true, // Required
        type: 'string'
    }
}

exports.handler = async function (argv) {
    const content = fs.readFileSync(argv.file)
    
    transaction = null
    txBuilder = archethic.newTransactionBuilder("hosting")
        .setContent(content)
    
    const address = archethic.deriveAddress(argv.seed, 0)
    
    try {
        index = await archethic.getTransactionIndex(address, argv.endpoint)
    } catch (e) {
        console.error(chalk.red(e.message))
        return
    }

    transaction = txBuilder
        .build(argv.seed, index)
        .originSign(originPrivateKey)


    try {
        send_file = await archethic.sendTransaction(transaction, argv.endpoint)
        if (send_file.status == 'ok') {
            console.log(chalk.green("Transaction Sent Successfully !"))
            console.log(chalk.blue(argv.endpoint + "/api/last_transaction/" + (toHex(transaction.address)) + "/content?mime=" + mime.getType(argv.file)))
        } else {
            throw new Error("Transaction not deployed ! Please check if funds are transferred successfully to the generated address")
        }
    } catch (e) {
        console.error(chalk.red(e.message))
        return
    }
}