const { getindex, setcontent, buildtxn, feeconfirmation } = require('../lib/functions')
const archethic = require('archethic')
const chalk = require('chalk')
const mime = require('mime')
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
        
        const ok =  await feeconfirmation(transaction, argv.endpoint)
      
        if (ok)
        {
        archethic.waitConfirmations(transaction.address, argv.endpoint, function(nbConfirmations) {
            if(nbConfirmations == 1)
            {
                console.log(chalk.green("Transaction Sent Successfully !"))
                console.log(chalk.blue(argv.endpoint + "/api/last_transaction/" + address + "/content?mime=" + mime.getType(argv.file)))
            }
            console.log(chalk.magenta("Transaction confirmed with " + nbConfirmations + " replications"))
        })

        send_file = await archethic.sendTransaction(transaction, argv.endpoint)
          
        }
        
        
    } catch (e) {
        console.error(e)
        return
    }
}