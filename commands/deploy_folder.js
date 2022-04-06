const archethic = require('archethic')
const {
    getTransactionIndex,
    sendtxn,
    buildTransferTransaction,
    buildHostingTransaction,
    waitConfirmations,
    setFileContent
} = require('../lib/transaction_builder')
const {
    list_files_dir,
    generate_seed_and_address
} = require('../lib/file_management')
const chalk = require('chalk')
const algo = 'sha256'
const yesno = require('yesno')
let Files = []
let Seed = []
let Address = []
let tfee = 0
let usd = 0
let eur = 0

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


    for (let i = 0; i < Files.length; i++)
    {
        Seed.push(generate_seed_and_address(Files[i], algo, argv.seed).seed)
        Address.push(generate_seed_and_address(Files[i],algo,argv.seed).address)
    }

    let txn = buildTransferTransaction(Address, argv.seed)

    await sendtxn(txn, argv.endpoint)

    async function prepare_transaction (Files)
    {
        
    let seed = generate_seed_and_address(Files, algo, argv.seed).seed
        
    let address = generate_seed_and_address(Files, algo, argv.seed).address

    const content = setFileContent(Files)

    let index = await getTransactionIndex(address, argv.endpoint)

    let transaction = buildHostingTransaction(content,seed,index)

    return {transaction,address}

    }

    for (let i = 0; i < Files.length; i++) {
       
        let transaction = (await prepare_transaction(Files[i])).transaction

        try {
          
            const { fee: fee, rates: rates } = await archethic.getTransactionFee(transaction, argv.endpoint)
            
            console.log(chalk.cyan(Files[i]))

            tfee += fee
            usd += rates.usd
            eur += rates.eur

        } catch (e) {
            console.error(chalk.red(e.message))
            return
        }

    }

    const ok = await yesno({
        question:  chalk.yellow('The transaction would cost ' +tfee+ ' UCO ($ ' +usd+ ' € ' +eur+ '). Do you want to confirm ?')
    });

    for (let i = 0; i < Files.length; i++) {
       
        let transaction = (await prepare_transaction(Files[i])).transaction

        let address = (await prepare_transaction(Files[i])).address

        try {
          
            if (ok) {

                let message = Files[i] + " deployed successfully"
                
                waitConfirmations(transaction,address,argv.endpoint,Files[i],message)

                await sendtxn(transaction, argv.endpoint)
            }

        } catch (e) {
            console.error(chalk.red(e.message))
            return
        }

    }

}