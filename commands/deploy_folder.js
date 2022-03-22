const fs = require('fs')
const archethic = require('archethic')
const originPrivateKey = "01009280BDB84B8F8AEDBA205FE3552689964A5626EE2C60AA10E3BF22A91A036009"
const chalk = require('chalk')
const mime = require('mime')
const path = require('path')
const crypto = require('crypto')
const algo = 'sha256'
let Files = []
let Seed = []
let Address = []
let tx
let send_folder
let index

exports.command = 'deploy-folder'

exports.describe = 'Deploy all files inside folder on Archethic Public Blockchain'

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

    folder: {
        describe: 'Folder is the name of folder',
        demandOption: true, // Required
        type: 'string'
    }
}

exports.handler = async function (argv) {
    function ReadDirectory(Directory) {
        try {
            fs.readdirSync(Directory).forEach(File => {
                const abs = path.join(Directory, File);
                if (fs.statSync(abs).isDirectory()) return ReadDirectory(abs);
                else return Files.push(abs);
            });
        } catch (e) {
            console.error(chalk.red(e.message))
            return
        }
    }

    ReadDirectory(argv.folder);

    for (let i = 0; i < Files.length; i++) {
        const hmac = crypto.createHmac(algo, argv.seed);
        hmac.update(Files[i])
        const seed = hmac.digest('hex')
        Seed.push(seed)
        const address = archethic.deriveAddress(seed, 0)
        Address.push(address)
    }

    tx = archethic.newTransactionBuilder("transfer")

    for (let i = 0; i < Address.length; i++) {
        tx.addUCOTransfer(Address[i], 10.0)
    }

    txn = tx
        .build(argv.seed, 0)
        .originSign(originPrivateKey)

    try {
        await archethic.sendTransaction(txn, argv.endpoint)
    } catch (e) {
        console.error(chalk.red(e.message))
        return
    }

    for (let i = 0; i < Files.length; i++) {
        const hmac = crypto.createHmac(algo, argv.seed);
        hmac.update(Files[i])
        const seed = hmac.digest('hex')
        const address = archethic.deriveAddress(seed, 0)

        const content = fs.readFileSync(Files[i])

        transaction = null
        const txBuilder = archethic.newTransactionBuilder("hosting")
        txBuilder.setContent(content)

        try {
            index = await archethic.getTransactionIndex(address, argv.endpoint)
        } catch (e) {
            console.error(chalk.red(e.message))
            return
        }
        transaction = txBuilder
            .build(seed, index)
            .originSign(originPrivateKey)

        try {
            const { fee: fee } = await archethic.getTransactionFee(transaction, argv.endpoint)
            console.log(chalk.yellow("Transaction fee : " +fee))


            archethic.waitConfirmations(transaction.address, argv.endpoint, function(nbConfirmations) {
                console.log(chalk.magenta("Transaction confirmed with " + nbConfirmations + " replications"))
            })


            send_folder = await archethic.sendTransaction(transaction, argv.endpoint)
            
            console.log(chalk.cyan(Files[i]))
            console.log(chalk.blue(argv.endpoint + "/api/last_transaction/" + address + "/content?mime=" + mime.getType(Files[i])))
            
        } catch (e) {
            console.error(chalk.red(e.message))
            return
        }

    }
}