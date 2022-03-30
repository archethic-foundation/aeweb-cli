const assert = require('assert')
const archethic = require('archethic')

describe('Address Generation', () => {
    it('Should generate address', async () => {
        const address = archethic.deriveAddress('myseed', 0)
        assert.strictEqual(address, "00008b31557628b8c735df2545eeb1e9e985b965d0bc0c38ff6c409d4b990af2330c")
    })
})