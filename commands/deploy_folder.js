const archethic = require('archethic')
const {
    getTransactionIndex,
    feeconfirmation,
    buildtxn,
    sendtxn,
    buildTransferTransaction,
    buildHostingTransaction,
    folder_waitConfirmations
} = require('../lib/transaction_builder')
const {
    list_files_dir,
    generate_seed_and_address_for_every_file,
    generate_seed_and_address
} = require('../lib/file_management')
const chalk = require('chalk')
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

    list_files_dir(argv.folder, Files)

    generate_seed_and_address_for_every_file(Files, algo, argv.seed, Seed, Address)

    buildTransferTransaction(Address, argv.seed)

    await sendtxn(txn, argv.endpoint)

    for (let i = 0; i < Files.length; i++) {
       
        x = Files[i]
        let seed = generate_seed_and_address(x, algo, argv.seed).seed
        let address = generate_seed_and_address(x, algo, argv.seed).address


        buildHostingTransaction(Files[i])

        index = await getTransactionIndex(address, argv.endpoint)

        buildtxn(seed, index)

        try {

            const ok = await feeconfirmation(transaction, argv.endpoint)

            if (ok) {

                x = Files[i]
                
                folder_waitConfirmations(transaction,address,argv.endpoint,x)


                await sendtxn(transaction, argv.endpoint)
            }

        } catch (e) {
            console.error(chalk.red(e.message))
            return
        }

    }

}