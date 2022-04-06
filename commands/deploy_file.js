const {
    getTransactionIndex,
    buildHostingTransaction,
    sendtxn,
    feeConfirmation,
    waitConfirmations,
    setFileContent,
    gennerateAddress
} = require('../lib/transaction_builder')
let transaction


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

    const content = setFileContent(argv.file)

    const address = gennerateAddress(argv.seed, 0)

    let index = await getTransactionIndex(address, argv.endpoint)

    transaction = buildHostingTransaction(content, argv.seed, index)

    const ok = await feeConfirmation(transaction, argv.endpoint)

    try {


        if (ok) {

            let message = "Transaction Sent Successfully"

            waitConfirmations(transaction, address, argv.endpoint, argv.file, message)


            await sendtxn(transaction, argv.endpoint)

        }


    } catch (e) {
        console.error(e)
        return
    }
}