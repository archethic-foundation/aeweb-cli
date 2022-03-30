const assert = require('assert')
const fs = require('fs')
const archethic = require('archethic')
const originPrivateKey = "01009280BDB84B8F8AEDBA205FE3552689964A5626EE2C60AA10E3BF22A91A036009"
const mime = require('mime')
const path = require('path')
const crypto = require('crypto')
const algo = 'sha256'
const jsdom = require("jsdom")
const {
    JSDOM
} = jsdom
let Files = []
let Seed = []
let Address = []
let array_files = []
let array_address = []
let tx
let send_folder
let index

describe('Website deployment test', () => {
    it('Should deploy the website', async () => {
        function ReadDirectory(Directory) {
                fs.readdirSync(Directory).forEach(File => {
                    const abs = path.join(Directory, File);
                    if (fs.statSync(abs).isDirectory()) return ReadDirectory(abs);
                    else return Files.push(abs);
                });
        }

        ReadDirectory("website-test");

        for (let i = 0; i < Files.length; i++) {
            const hmac = crypto.createHmac(algo, 'myseed');
            hmac.update(Files[i])
            const seed = hmac.digest('hex')
            Seed.push(seed)
            const address = archethic.deriveAddress(seed, 0)
            Address.push(address)
        }

        tx = archethic.newTransactionBuilder("transfer")

        for (let i = 0; i < Address.length; i++) {
            tx.addUCOTransfer(Address[i], 1.0)
        }

        txn = tx
            .build('myseed', 0)
            .originSign(originPrivateKey)


        await archethic.sendTransaction(txn, "http://localhost:4000")


        for (let i = 0; i < Files.length; i++) {

            const hmac = crypto.createHmac(algo, 'myseed');
            hmac.update(Files[i])
            const seed = hmac.digest('hex')
            const address = archethic.deriveAddress(seed, 0)
            const content = fs.readFileSync(Files[i])
            transaction = null
            const txBuilder = archethic.newTransactionBuilder("hosting")
            txBuilder.setContent(content)

            index = await archethic.getTransactionIndex(address, "http://localhost:4000")

            transaction = txBuilder
                .build(seed, index)
                .originSign(originPrivateKey)


            archethic.waitConfirmations(transaction.address, "http://localhost:4000", function (nbConfirmations) {
                assert.strictEqual(nbConfirmations,1)
            })


            send_folder = await archethic.sendTransaction(transaction, "http://localhost:4000")

            assert.strictEqual(send_folder.status, "pending")

            array_files.push((Files[i].substring(Files[i].indexOf('/') + 1)))
            array_address.push(address)
        }



        for (let i = 0; i < array_files.length; i++) {
            if ((array_files[i] == 'index.html')) {

                const dom = await JSDOM.fromFile("website-test" + "/index.html")

                var nodelist = dom.window.document.querySelectorAll('[src],[href]');

                for (let i = 0; i < nodelist.length; ++i) {
                    var item = nodelist[i];


                    for (let i = 0; i < array_files.length; i++) {

                        if (String(item.getAttribute('src')).substring(String(item.getAttribute('src')).lastIndexOf('/') + 1) == (array_files[i].substring(array_files[i].lastIndexOf('/') + 1))) {
                            item.setAttribute('src', "http://localhost:4000" + "/api/last_transaction/" + array_address[i] + "/content?mime=" + mime.getType(array_files[i]))
                        }

                        if (String(item.getAttribute('href')).substring(String(item.getAttribute('href')).lastIndexOf('/') + 1) == (array_files[i].substring(array_files[i].lastIndexOf('/') + 1))) {
                            item.setAttribute('href', "http://localhost:4000" + "/api/last_transaction/" + array_address[i] + "/content?mime=" + mime.getType(array_files[i]))
                        }
                    }


                }

                data = dom.serialize()
                try {
                    fs.writeFileSync("website-test" + "/index.html", data)

                } catch (err) {
                    console.error(err)
                }


                const hmac = crypto.createHmac(algo, 'myseed');
                hmac.update("website-test" + "/index.html")
                const seed = hmac.digest('hex')
                const address = archethic.deriveAddress(seed, 0)

                const content = fs.readFileSync("website-test" + "/index.html")

                transaction = null
                const txBuilder = archethic.newTransactionBuilder("hosting")
                txBuilder.setContent(content)


                index = await archethic.getTransactionIndex(address, "http://localhost:4000")

                transaction = txBuilder
                    .build(seed, index)
                    .originSign(originPrivateKey)


                archethic.waitConfirmations(transaction.address, "http://localhost:4000", function (nbConfirmations) {
                    assert.strictEqual(nbConfirmations,1)
                })

                send_folder = await archethic.sendTransaction(transaction, "http://localhost:4000")
                assert.strictEqual(send_folder.status, "pending")

            }
        }
    })
})