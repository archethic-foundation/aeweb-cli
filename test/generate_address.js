const assert = require('assert')
const yargs = require('yargs')

describe('Address Generation', () => {
    it('Should generate address', async () => {
        const parser = yargs.command(require('../commands/generate_address')).help();

        const output = await new Promise((resolve) => {
          parser.parse("generate-address --seed=myseed --index=0", (err, argv, output) => {
            resolve(output);
          })
         
        });
    })
})