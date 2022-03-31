const assert = require('assert')
const yargs = require('yargs')

describe('Single file deployment test', () => {
    it('Should deploy file', async () => {

        const parser = yargs.command(require('../commands/deploy_file')).help();

        const output = await new Promise((resolve) => {
          parser.parse("deploy-file --seed=myseed --endpoint=http://localhost:4000 --file=./aeweb.js", (err, argv, output) => {
            resolve(output);
          })
         
        });

    });

});

