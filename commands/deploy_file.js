const fs = require('fs')
const archethic = require('archethic')
const originPrivateKey = "01009280BDB84B8F8AEDBA205FE3552689964A5626EE2C60AA10E3BF22A91A036009"
const chalk = require('chalk')
const mime = require('mime')
const yesno = require('yesno');
let transaction
let send_file
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
        const { fee: fee, rates: rates } = await archethic.getTransactionFee(transaction, argv.endpoint)
        
        const ok = await yesno({
            question: chalk.yellow('The transaction would cost ' +fee+ ' UCO ($ ' +rates.usd+ ' € ' +rates.eur+ '). Do you want to confirm ?')
        });

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
        console.error(chalk.red(e.message))
        return
    }
}