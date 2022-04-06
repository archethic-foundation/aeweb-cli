const assert = require('assert')
const { generate_seed_and_address } = require('../lib/file_management')
const { getTransactionIndex, sendtxn, setFileContent, waitConfirmations, buildHostingTransaction, gennerateAddress } = require('../lib/transaction_builder')

describe('Get Transaction Index', () => {
    it('Should generate transaction index', async () => {
        const index = await getTransactionIndex('0000fb5ef699000d593f3ce9a37f13f3649c838b4d1ff424ca9cc9dc060f772c3a03','http://localhost:4000')
        assert.strictEqual(index,0)
    })
})

describe('Send Transaction', () => {
    it('Should send a transaction', async () => {
        const content = setFileContent('./aeweb.js')
        txn = buildHostingTransaction(content,'aeweb',0)
        const send = await sendtxn(txn,'http://localhost:4000')
        assert.strictEqual(send.status,'pending')
    })
})

describe('Generate Address', () => {
    it('Should generate address', () => {
        const address = gennerateAddress('aeweb',0)
        assert.strictEqual(address,'0000100da8d44126c2ab125c88b4b0407ad3a5dd11f6f5d77df6d7799629a6c612a4')
    })
})

describe('Generate Address and Seed using hmac', () => {
    it('Should generate address and seed using hmac', () => {
        let address = generate_seed_and_address('./aeweb.js','sha256','aeweb').address
        let seed = generate_seed_and_address('./aeweb.js','sha256','aeweb').seed
        
        assert.strictEqual(address,'0000dca709bafa2ff3101ab76f440bed9fbdda92342087c2681a5ccb5856edad3e21')
        assert.strictEqual(seed,'fbd5dc0a184b2cc34f6dff51b51526f407295732b3e1b32b2b1e76953f85b879')
    })
})