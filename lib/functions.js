const originPrivateKey = "01009280BDB84B8F8AEDBA205FE3552689964A5626EE2C60AA10E3BF22A91A036009"
const archethic = require('archethic')
const yesno = require('yesno')
const chalk = require('chalk')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

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

    getindex: async (address, endpoint) => {
        try {
            index = await archethic.getTransactionIndex(address, endpoint)
            return index
        } catch (e) {
            console.error(chalk.red(e.message))
            return
        }
    },

    hmac: function(Files,algo,myseed,Seed,Address)
    {
        for (let i = 0; i < Files.length; i++) {
            const hmac = crypto.createHmac(algo, myseed);
            hmac.update(Files[i])
            const seed = hmac.digest('hex')
            Seed.push(seed)
            const address = archethic.deriveAddress(seed, 0)
            Address.push(address)
        }
    },

    readdir: function(Directory,Files)
    {
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

    setcontent: function(file)
    {
        const content = fs.readFileSync(file)
    
        transaction = null
        txBuilder = archethic.newTransactionBuilder("hosting")
            .setContent(content)
    },

    transfer: function (Address,seed)
    {
        tx = archethic.newTransactionBuilder("transfer")

        for (let i = 0; i < Address.length; i++) {
            tx.addUCOTransfer(Address[i], 10.0)
        }

        txn = tx
            .build(seed, 0)
            .originSign(originPrivateKey)

    }












}