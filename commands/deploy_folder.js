const archethic = require('archethic')
const {
    getindex,
    feeconfirmation,
    setcontent,
    buildtxn,
    sendtxn,
    transfer
} = require('../lib/transaction_builder')
const {
    readdir,
    hmac,
    folder_waitConfirmations
} = require('../lib/file_management')
const chalk = require('chalk')
const crypto = require('crypto')
const algo = 'sha256'
let Files = []
let Seed = []
let Address = []
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

    readdir(argv.folder, Files)

    hmac(Files, algo, argv.seed, Seed, Address)

    transfer(Address, argv.seed)

    await sendtxn(txn, argv.endpoint)

    for (let i = 0; i < Files.length; i++) {
        const hmac = crypto.createHmac(algo, argv.seed);
        hmac.update(Files[i])
        const seed = hmac.digest('hex')
        const address = archethic.deriveAddress(seed, 0)

        setcontent(Files[i])

        index = await getindex(address, argv.endpoint)

        buildtxn(seed, index)

        try {

            const ok = await feeconfirmation(transaction, argv.endpoint)

            if (ok) {

                x = Files[i]
                
                folder_waitConfirmations(transaction,address,argv.endpoint,x)


                send_folder = await sendtxn(transaction, argv.endpoint)
            }

        } catch (e) {
            console.error(chalk.red(e.message))
            return
        }

    }

}