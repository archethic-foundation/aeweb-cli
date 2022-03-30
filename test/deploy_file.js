const assert = require('assert')
const fs = require('fs')
const archethic = require('archethic')
const originPrivateKey = "01009280BDB84B8F8AEDBA205FE3552689964A5626EE2C60AA10E3BF22A91A036009"
let transaction
let send_file
let index

describe('Single file deployment test', () => {
    it('Should deploy file', async () => {


        const content = fs.readFileSync("aeweb.js")

        transaction = null
        txBuilder = archethic.newTransactionBuilder("hosting")
            .setContent(content)

        const address = archethic.deriveAddress("myseed", 0)

        assert.strictEqual(address, "00008b31557628b8c735df2545eeb1e9e985b965d0bc0c38ff6c409d4b990af2330c")

        index = await archethic.getTransactionIndex(address, "http://localhost:4000")


        transaction = txBuilder
            .build("myseed", index)
            .originSign(originPrivateKey)



        archethic.waitConfirmations(transaction.address, "http://localhost:4000", function (nbConfirmations) {
           
            assert.strictEqual(nbConfirmations,1)

        })

        send_file = await archethic.sendTransaction(transaction, "http://localhost:4000")

        assert.strictEqual(send_file.status, "pending")


    });

});

