const {
    getindex,
    setcontent,
    buildtxn,
    sendtxn,
    feeconfirmation
} = require('../lib/transaction_builder')
const { file_waitConfirmations } = require('../lib/file_management')
const archethic = require('archethic')
let transaction
let index


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

    setcontent(argv.file)

    const address = archethic.deriveAddress(argv.seed, 0)

    index = await getindex(address, argv.endpoint)

    transaction = buildtxn(argv.seed, index)


    try {

        const ok = await feeconfirmation(transaction, argv.endpoint)

        if (ok) {
           
            file_waitConfirmations(transaction,address,argv.endpoint,argv.file)


            await sendtxn(transaction, argv.endpoint)

        }


    } catch (e) {
        console.error(e)
        return
    }
}