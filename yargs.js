#!/usr/bin/env node
const yargs = require('yargs')
const archethic = require('archethic')
const fs = require('fs')
const imageToBase64 = require('image-to-base64')
const chalk = require('chalk')
const figlet = require('figlet')

yargs.command({
    command: 'about',
    describe: 'Welcome',
   

    handler: function (argv)
    {   
        console.log(chalk.green('\n','Hello and Welcome to DeWeb !','\n'))
        console.log(chalk.blue(figlet.textSync('DeWeb',{font : "3d"})))
        console.log(chalk.green('\n','Create your Website on top of Archethic Public Blockchain by Uniris'))
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
        }
    },

    handler: function (argv)
    {   
        
        const address = archethic.deriveAddress(argv.seed, 0)
        console.log(chalk.blue(address))
        // Address: 004195d45987f33e5dcb71edfa63438d5e6add655b216acfdd31945d58210fe5d2
        
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

        curve: {
            describe: 'Curve',
            demandOption: true,  // Required
            type: 'string'     
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
        
        
        
        //content = "hello manuj"
            transaction = null
            txBuilder = archethic.newTransactionBuilder("transfer")
                        .setContent(content)
        
        
            
        transaction = txBuilder
                        .build(argv.seed, argv.index, argv.curve)
                        .originSign(originPrivateKey)
            
        console.log (chalk.green(toHex(transaction.address)))
        

        //endpoint = "http://localhost:4000"
        archethic.sendTransaction(transaction, argv.endpoint).then((data) => {
            if (data.errors) {
                JSON.stringify(data.errors, undefined, 2)
                
                console.log(data.errors)
            }
            
            //console.log(chalk.blue(figlet.textSync('DeWeb',{font : "3d"})))
            console.log(chalk.blue("Transaction Sent Successfully !"))
            
        })
    }
    })

    yargs.command({
        command: 'imgtob64',
        describe: 'Convert Image to b64',
        builder: {
            path: {
                describe: 'Path',
                demandOption: true,  // Required
                type: 'string'     
            }
        },
    
        handler: function (argv)
        {   
            
            
            imageToBase64(argv.path)
                .then(
                    (response) => {
                    console.log(response); 
                }
            )
            .catch(
                (error) => {
                console.log(error); 
                }
            )
            
        }
    })
    

    
yargs.parse()