const originPrivateKey = "01009280BDB84B8F8AEDBA205FE3552689964A5626EE2C60AA10E3BF22A91A036009"
const archethic = require('archethic')
const yesno = require('yesno')
const chalk = require('chalk')
const fs = require('fs')
const mime = require('mime')

function confirmationCallback(endpoint, address, message, file) {
    return (nbConfirmations) => {
        if (nbConfirmations == 1) {
            console.log(chalk.green(message))
            console.log(chalk.blue(endpoint + "/api/last_transaction/" + address + "/content?mime=" + mime.getType(file)))
        }
        console.log(chalk.magenta("Transaction confirmed with " + nbConfirmations + " replications"))
    }

}

module.exports = {
    buildtxn: function(seed,index)
    {
        transaction = txBuilder
            .build(seed, index)
            .originSign(originPrivateKey)
        
        return transaction
    },

    feeconfirmation: async (transaction,endpoint) =>
    {
    const { fee: fee, rates: rates } = await archethic.getTransactionFee(transaction, endpoint)
        
        const ok = await yesno({
            question: chalk.yellow('The transaction would cost ' +fee+ ' UCO ($ ' +rates.usd+ ' € ' +rates.eur+ '). Do you want to confirm ?')
        });
        if(ok)
        {
            return true
        }
        else
        {
            return false
        }
    },

    getTransactionIndex: async (address, endpoint) => {
        try {
            index = await archethic.getTransactionIndex(address, endpoint)
            return index
        } catch (e) {
            console.error(chalk.red(e.message))
            return
        }
    },


    sendtxn: async (txn,endpoint) =>{
        {
            try {
                await archethic.sendTransaction(txn, endpoint)
            } catch (e) {
                console.error(chalk.red(e.message))
                return
            }
        }
    },

    buildHostingTransaction: function(file)
    {
        const content = fs.readFileSync(file)
    
        transaction = null
        txBuilder = archethic.newTransactionBuilder("hosting")
            .setContent(content)
    },

    buildTransferTransaction: function (Address,seed)
    {
        tx = archethic.newTransactionBuilder("transfer")

        for (let i = 0; i < Address.length; i++) {
            tx.addUCOTransfer(Address[i], 10.0)
        }

        txn = tx
            .build(seed, 0)
            .originSign(originPrivateKey)

    },

    file_waitConfirmations: function (transaction, address, endpoint, file) {
        message = "Transaction Sent Successfully"
        archethic.waitConfirmations(transaction.address, endpoint,
            confirmationCallback(endpoint,address,message,file)
        )

    },

    folder_waitConfirmations: function (transaction, address, endpoint, file) {
       
        message = x + " deployed successfully"
        archethic.waitConfirmations(transaction.address, endpoint,
            confirmationCallback(endpoint,address,message,file)
        )

    },

    website_waitConfirmations: function (transaction, address, endpoint, file) {
       
        message = "Check your website at-"
        archethic.waitConfirmations(transaction.address, endpoint,
            confirmationCallback(endpoint,address,message,file)
        )

    }

}