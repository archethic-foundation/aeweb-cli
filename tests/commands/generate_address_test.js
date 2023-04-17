import generateAddress from '../../commands/generate_address.js';
import { expect } from 'chai';
import { Crypto, Utils } from 'archethic'


describe('generate_address', () => {

    it("should be generate-address", () => {
        expect(generateAddress.command).to.equal("generate-address");
        expect(generateAddress.builder).deep.equal({
            seed: {
                describe: 'Seed is a string representing the transaction chain entropy to be able to derive and generate the keys for the transactions',
                demandOption: true,
                type: 'string',
                alias: 's'
            },
            index: {
                describe: 'Index is the number of transactions in the chain, to generate the current and the next public key',
                demandOption: true,
                type: 'number',
                alias: 'i'
            }
        });
        expect(generateAddress.describe).to.equal("Generate Address - to transfer some funds to this address");
    })


    it("should generate address according to index and seed", () => {
        const seed = "seed", index = 10;
        const expectedAddress = Crypto.deriveAddress(seed, index)
        var logs = [];
        var oldLog = console.log;
        console.log = function (msg) {
            logs.push(msg);
        };

        generateAddress.handler({ seed, index })
        // https://gist.github.com/enten/cef219142ca6350cdd07ef6b58eb7636
        expect(logs[0]).to.equal(`\u001B[34m${Utils.uint8ArrayToHex(expectedAddress)}\u001b[39m`);
        expect(logs[1]).to.equal(`\u001b[32mIf you are using testnet go to https://testnet.archethic.net/faucet & add some funds to the generated address, otherwise transfer funds from your UCO wallet (in Mainnet)\u001b[39m`);
        console.log = oldLog;
    });
});
