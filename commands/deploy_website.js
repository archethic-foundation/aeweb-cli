const fs = require('fs')
const archethic = require('archethic')
const originPrivateKey = "01009280BDB84B8F8AEDBA205FE3552689964A5626EE2C60AA10E3BF22A91A036009"
const chalk = require('chalk')
const mime = require('mime')
const path = require('path')
const crypto = require('crypto')
const algo = 'sha256'
const jsdom = require("jsdom")
const { JSDOM } = jsdom
const yesno = require('yesno');
let Files = []
let Seed = []
let Address = []
let array_files = []
let array_address = []
let tx
let send_folder
let index

exports.command = 'deploy-website'

exports.describe = 'Deploy all files inside folder and target index.html file to automatically convert filepaths to transactions'

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
    function ReadDirectory(Directory) {
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

    try {
        await archethic.sendTransaction(txn, argv.endpoint)
    } catch (e) {
        console.error(chalk.red(e.message))
        return
    }

    for (let i = 0; i < Files.length; i++) {

        const hmac = crypto.createHmac(algo, argv.seed);
        hmac.update(Files[i])
        const seed = hmac.digest('hex')
        const address = archethic.deriveAddress(seed, 0)

        const content = fs.readFileSync(Files[i])

        transaction = null
        const txBuilder = archethic.newTransactionBuilder("hosting")
        txBuilder.setContent(content)

        try {
            index = await archethic.getTransactionIndex(address, argv.endpoint)
        } catch (e) {
            console.error(chalk.red(e.message))
            return
        }
        transaction = txBuilder
            .build(seed, index)
            .originSign(originPrivateKey)

        try {
            const { fee: fee, rates: rates } = await archethic.getTransactionFee(transaction, argv.endpoint)
            
            const ok = await yesno({
                question:  chalk.yellow('The transaction would cost ' +fee+ ' UCO ($ ' +rates.usd+ ' € ' +rates.eur+ '). Do you want to confirm ?')
            });

            if(ok)
            {
            archethic.waitConfirmations(transaction.address, argv.endpoint, function(nbConfirmations) {
                if(nbConfirmations == 1)
                {
                    console.log(chalk.cyan(Files[i]))
                    console.log(chalk.blue(argv.endpoint + "/api/last_transaction/" + address + "/content?mime=" + mime.getType(Files[i])))
                }
                console.log(chalk.magenta("Transaction confirmed with " + nbConfirmations + " replications"))
            })


            send_folder = await archethic.sendTransaction(transaction, argv.endpoint)
            
            array_files.push((Files[i].substring(Files[i].indexOf('/') + 1)))
            array_address.push(address)
            }

            
        } catch (e) {
            console.error(chalk.red(e.message))
            return
        }

    }

    for (let i = 0; i < array_files.length; i++) {
        if ((array_files[i] == 'index.html')) {

            const dom = await JSDOM.fromFile(argv.folder + "/index.html")

            var nodelist = dom.window.document.querySelectorAll('[src],[href]');

            for (let i = 0; i < nodelist.length; ++i) {
                var item = nodelist[i];


                for (let i = 0; i < array_files.length; i++) {

                    if (String(item.getAttribute('src')).substring(String(item.getAttribute('src')).lastIndexOf('/') + 1) == (array_files[i].substring(array_files[i].lastIndexOf('/') + 1))) {
                        item.setAttribute('src', argv.endpoint + "/api/last_transaction/" + array_address[i] + "/content?mime=" + mime.getType(array_files[i]))
                    }

                    if (String(item.getAttribute('href')).substring(String(item.getAttribute('href')).lastIndexOf('/') + 1) == (array_files[i].substring(array_files[i].lastIndexOf('/') + 1))) {
                        item.setAttribute('href', argv.endpoint + "/api/last_transaction/" + array_address[i] + "/content?mime=" + mime.getType(array_files[i]))
                    }
                }


            }

            data = dom.serialize()
            try {
                fs.writeFileSync(argv.folder + "/index.html", data)

            } catch (err) {
                console.error(err)
            }


            const hmac = crypto.createHmac(algo, argv.seed);
            hmac.update(argv.folder + "/index.html")
            const seed = hmac.digest('hex')
            const address = archethic.deriveAddress(seed, 0)

            const content = fs.readFileSync(argv.folder + "/index.html")

            transaction = null
            const txBuilder = archethic.newTransactionBuilder("hosting")
            txBuilder.setContent(content)

            try {
                index = await archethic.getTransactionIndex(address, argv.endpoint)
            } catch (e) {
                console.error(chalk.red(e.message))
                return
            }
            transaction = txBuilder
                .build(seed, index)
                .originSign(originPrivateKey)

            try {
                const { fee: fee, rates: rates } = await archethic.getTransactionFee(transaction, argv.endpoint)
               

                const ok = await yesno({
                    question:  chalk.yellow('The transaction would cost ' +fee+ ' UCO ($ ' +rates.usd+ ' € ' +rates.eur+ '). Do you want to confirm ?')
                });

                if(ok)
                {
                archethic.waitConfirmations(transaction.address, argv.endpoint, function(nbConfirmations) {
                    if(nbConfirmations == 1)
                    {
                        console.log(chalk.green('Check your website at-'))
                        console.log(chalk.blue(argv.endpoint + "/api/last_transaction/" + address + "/content?mime=" + mime.getType(Files[i])))
                    }
                    console.log(chalk.magenta("Transaction confirmed with " + nbConfirmations + " replications"))
                })

                send_folder = await archethic.sendTransaction(transaction, argv.endpoint)
                }

            } catch (e) {
                console.error(chalk.red(e.message))
                return
            }
        }
    }
}