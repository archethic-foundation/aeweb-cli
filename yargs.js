#!/usr/bin/env node
const yargs = require('yargs')
const archethic = require('archethic')
const fs = require('fs')
const chalk = require('chalk')
const figlet = require('figlet')
const fileExtension = require('file-extension')



yargs.command({
    command: 'about',
    describe: 'Welcome',
   

    handler: function (argv)
    {   
        console.log(chalk.green('\n','Hello and Welcome to AeWeb !','\n'))
        console.log(chalk.blue(figlet.textSync('AeWeb',{font : "Alligator2"})))
        console.log(chalk.green('\n','Create your Website on top of ArchEthic'))
        console.log(chalk.green('\n','Version - 1.0.0','\n'))
        
    }
})

yargs.command({
    
    command: 'generate-address',
    describe: 'Generate',
    builder: {
        seed: {
            describe: 'Seed',
            demandOption: true,  // Required
            type: 'string'     
        },
        index: {
            describe: 'Index',
            demandOption: true,  // Required
            type: 'number'     
        }
       
    },
    
    handler: function (argv)
    {   
        const address = archethic.deriveAddress(argv.seed, argv.index)
        console.log(chalk.blue(address))
        console.log(chalk.green("If you are using testnet go to https://testnet.archethic.net/faucet & add some funds to the generated address, otherwise transfer funds from your UCO wallet (in Mainnet)"))
    
        
    }
})


yargs.command({
    command: 'generate-transaction',
    describe: 'Generate',
    builder: {
        seed: {
            describe: 'Seed',
            demandOption: true,  // Required
            type: 'string'     
        },

        index: {
            describe: 'Index',
            demandOption: true,  // Required
            type: 'number'     
        },

        endpoint: {
            describe: 'Node Endpoint',
            demandOption: true,  // Required
            type: 'string'     
        },

        path: {
            describe: 'Path',
            demandOption: true,  // Required
            type: 'string'     
        }


    },

    handler: function (argv)
    {   function toHex(bytes) {
                return bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '');
        }
        
        const originPrivateKey = "01009280BDB84B8F8AEDBA205FE3552689964A5626EE2C60AA10E3BF22A91A036009"
        let transaction

        
        const content = fs.readFileSync(argv.path)
        
        
        
      
            transaction = null
            txBuilder = archethic.newTransactionBuilder("hosting")
                        .setContent(content)
        
        
            
        transaction = txBuilder
                        .build(argv.seed, argv.index, argv.curve)
                        .originSign(originPrivateKey)
            
        console.log (chalk.green(toHex(transaction.address)))
        
       
        
       
        archethic.sendTransaction(transaction, argv.endpoint).then(() => {
            
            
            
            console.log(chalk.blue("Transaction Sent Successfully !"))
            
            console.log(chalk.green(argv.endpoint+"/api/last_transaction/"+(toHex(transaction.address))+"/content?mime=text/"+fileExtension(argv.path)))
            
        })
    }
    })
   

    
yargs.parse()