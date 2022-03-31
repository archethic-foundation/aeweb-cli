const assert = require('assert')
const yargs = require('yargs')

describe('Multiple file deployment test', () => {
    it('Should deploy all files in folder', async () => {
        const parser = yargs.command(require('../commands/deploy_folder')).help();

        const output = await new Promise((resolve) => {
          parser.parse("deploy-folder --seed=myseed --endpoint=http://localhost:4000 --folder=commands", (err, argv, output) => {
            resolve(output);
          })
         
        });
    })
})