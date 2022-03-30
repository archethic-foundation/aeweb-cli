const assert = require('assert')
const fs = require('fs')
const archethic = require('archethic')
const originPrivateKey = "01009280BDB84B8F8AEDBA205FE3552689964A5626EE2C60AA10E3BF22A91A036009"
const path = require('path')
const crypto = require('crypto')
const algo = 'sha256'
let Files = []
let Seed = []
let Address = []
let tx
let send_folder
let index

describe('Multiple file deployment test', () => {
    it('Should deploy all files in folder', async () => {
        function ReadDirectory(Directory) {
            
                fs.readdirSync(Directory).forEach(File => {
                    const abs = path.join(Directory, File);
                    if (fs.statSync(abs).isDirectory()) return ReadDirectory(abs);
                    else return Files.push(abs);
                });
            
        }
    
        ReadDirectory("commands");
    
        for (let i = 0; i < Files.length; i++) {
            const hmac = crypto.createHmac(algo, "myseed");
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
            .build("myseed", 0)
            .originSign(originPrivateKey)
    
       
            await archethic.sendTransaction(txn, "http://localhost:4000")
       
    
        for (let i = 0; i < Files.length; i++) {
            const hmac = crypto.createHmac(algo, "myseed");
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
    
                
                archethic.waitConfirmations(transaction.address, "http://localhost:4000", function(nbConfirmations) {
                   assert.strictEqual(nbConfirmations,1)
                })
    
    
                send_folder = await archethic.sendTransaction(transaction, "http://localhost:4000")
                
                assert.strictEqual(send_folder.status, "pending")
                
    
        }
    })
})