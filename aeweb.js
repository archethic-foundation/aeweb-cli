#!/usr/bin/env node

const yargs = require('yargs')
const archethic = require('archethic')
const path = require('path')
const crypto = require('crypto')
const fs = require('fs')
const chalk = require('chalk')
const figlet = require('figlet')
const mime = require('mime')
const originPrivateKey = "01009280BDB84B8F8AEDBA205FE3552689964A5626EE2C60AA10E3BF22A91A036009"
const algo = 'sha256'
let transaction
let Files = []
let Seed = []
let Address = []
let tx
let send_file
let send_folder


function toHex(bytes) {
    return bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '');
}

yargs.command({
    command: 'about',
    describe: 'Welcome',


    handler: function (argv) {
        console.log(chalk.green('\n', 'Hello and Welcome to AeWeb !', '\n'))
        console.log(chalk.blue(figlet.textSync('AeWeb', {
            font: "Alligator2"
        })))
        console.log(chalk.green('\n', 'Create your Website on top of ArchEthic Public Blockchain'))
        console.log(chalk.green('\n'))

    }
})

yargs.command({

    command: 'generate-address',
    describe: 'Generate Address',
    builder: {
        seed: {
            describe: 'Seed',
            demandOption: true, // Required
            type: 'string'
        },
        index: {
            describe: 'Index',
            demandOption: true, // Required
            type: 'number'
        }

    },

    handler: function (argv) {
        const address = archethic.deriveAddress(argv.seed, argv.index)
        console.log(chalk.blue(address))
        console.log(chalk.green("If you are using testnet go to https://testnet.archethic.net/faucet & add some funds to the generated address, otherwise transfer funds from your UCO wallet (in Mainnet)"))


    }
})


yargs.command({
    command: 'deploy-file',
    describe: 'Deploy file on-chain',
    builder: {
        seed: {
            describe: 'Seed',
            demandOption: true, // Required
            type: 'string'
        },

        endpoint: {
            describe: 'Node Endpoint',
            demandOption: true, // Required
            type: 'string'
        },

        file: {
            describe: 'Path of file',
            demandOption: true, // Required
            type: 'string'
        }


    },

    handler: async function (argv) {
        const content = fs.readFileSync(argv.file)
        transaction = null
        txBuilder = archethic.newTransactionBuilder("hosting")
            .setContent(content)
        const address = archethic.deriveAddress(argv.seed, 0)
        const index = await archethic.getTransactionIndex(address, argv.endpoint)
        transaction = txBuilder
            .build(argv.seed, index, argv.curve)
            .originSign(originPrivateKey)

      
        try {
            send_file = await archethic.sendTransaction(transaction, argv.endpoint)
            if (send_file.status == 'ok') {
                console.log(chalk.blue("Transaction Sent Successfully !"))
                console.log(chalk.green(argv.endpoint + "/api/last_transaction/" + (toHex(transaction.address)) + "/content?mime=" + mime.getType(argv.file)))
            } else {
                throw new Error("Transaction not deployed ! Please check if funds are transferred successfully to the generated address")
            }
        } catch (e) {
            console.error(chalk.red(e.message))
        }
    }
})

yargs.command({
    command: 'deploy-folder',
    describe: 'Deploy all files inside folder on-chain',
    builder: {
        seed: {
            describe: 'Seed',
            demandOption: true, // Required
            type: 'string'
        },

        endpoint: {
            describe: 'Node Endpoint',
            demandOption: true, // Required
            type: 'string'
        },

        folder: {
            describe: 'Folder Name',
            demandOption: true, // Required
            type: 'string'
        }
    },

    handler: async function (argv) {

        function ReadDirectory(Directory) {
            try {
                fs.readdirSync(Directory).forEach(File => {
                    const abs = path.join(Directory, File);
                    if (fs.statSync(abs).isDirectory()) return ReadDirectory(abs);
                    else return Files.push(abs);
                });
            } catch (e) {
                console.error(e.message)
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

        await archethic.sendTransaction(txn, argv.endpoint)

        for (let i = 0; i < Files.length; i++) {
            const hmac = crypto.createHmac(algo, argv.seed);
            hmac.update(Files[i])
            const seed = hmac.digest('hex')
            const address = archethic.deriveAddress(seed, 0)

            const content = fs.readFileSync(Files[i])

            transaction = null
            const txBuilder = archethic.newTransactionBuilder("hosting")
            txBuilder.setContent(content)

            const index = await archethic.getTransactionIndex(address, argv.endpoint)
            transaction = txBuilder
                .build(seed, index)
                .originSign(originPrivateKey)

            try {
                send_folder = await archethic.sendTransaction(transaction, argv.endpoint)
                if (send_folder.status == 'ok') {
                    console.log(chalk.yellow(Files[i]))
                    console.log(chalk.blue(argv.endpoint + "/api/last_transaction/" + address + "/content?mime=" + mime.getType(Files[i])))
                } else {
                    throw new Error(('Transaction not deployed ! Please check if funds are transferred successfully to the generated address'))
                }
            } catch (e) {
                console.error(chalk.red(e.message))
            }

        }
    }
})



yargs.parse()