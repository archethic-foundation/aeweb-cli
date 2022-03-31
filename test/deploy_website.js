const assert = require('assert')
const yargs = require('yargs')

describe('Website deployment test', () => {
    it('Should deploy the website', async () => {
        const parser = yargs.command(require('../commands/deploy_website')).help();

        const output = await new Promise((resolve) => {
          parser.parse("deploy-website --seed=myseed --endpoint=http://localhost:4000 --folder=website-test", (err, argv, output) => {
            resolve(output);
          })
         
        });
    })
})