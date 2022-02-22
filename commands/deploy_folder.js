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
let Files = []
let Seed = []
let Address = []
let array_files = []
let array_address = []
let tx
let send_folder
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
            send_folder = await archethic.sendTransaction(transaction, argv.endpoint)
            if (send_folder.status == 'ok') {
                console.log(chalk.yellow(Files[i]))
                console.log(chalk.blue(argv.endpoint + "/api/last_transaction/" + address + "/content?mime=" + mime.getType(Files[i])))
                array_files.push((Files[i].substring(Files[i].indexOf('/') + 1)))
                array_address.push(address)
            } else {
                throw new Error(('Transaction not deployed ! Please check if funds are transferred successfully to the generated address'))
            }
        } catch (e) {
            console.error(chalk.red(e.message))
            return
        }

    }

    for (let i = 0; i < array_files.length; i++) {
        if ((array_files[i] == 'index.html')) {

            JSDOM.fromFile(argv.folder + "/index.html").then(dom => {

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
                fs.writeFile(argv.folder + "/index.html", data, (err) => {
                    if (err)
                        console.log(err);
                    else {
                        fs.readFileSync(argv.folder + "/index.html", "utf8");
                    }
                });
            });
        }
    }
}