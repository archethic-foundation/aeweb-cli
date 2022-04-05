const archethic = require('archethic')
const chalk = require('chalk')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const jsdom = require("jsdom")
const {
    JSDOM
} = jsdom
const mime = require('mime')

function confirmationCallback(endpoint, address, message, file) {
    return (nbConfirmations) => {
        if (nbConfirmations == 1) {
            console.log(chalk.green(message))
            console.log(chalk.blue(endpoint + "/api/last_transaction/" + address + "/content?mime=" + mime.getType(file)))
        }
        console.log(chalk.magenta("Transaction confirmed with " + nbConfirmations + " replications"))
    }

}


module.exports = {

    hmac: function (Files, algo, myseed, Seed, Address) {
        for (let i = 0; i < Files.length; i++) {
            const hmac = crypto.createHmac(algo, myseed);
            hmac.update(Files[i])
            const seed = hmac.digest('hex')
            Seed.push(seed)
            const address = archethic.deriveAddress(seed, 0)
            Address.push(address)
        }
    },

    hmac2: function (x, algo, myseed) {

        const hmac = crypto.createHmac(algo, myseed);
        hmac.update(x)
        const seed = hmac.digest('hex')
        const address = archethic.deriveAddress(seed, 0)

        return {
            seed,
            address
        }

    },


    readdir: function (Directory, Files) {
        try {
            fs.readdirSync(Directory).forEach(File => {
                const abs = path.join(Directory, File);
                if (fs.statSync(abs).isDirectory()) return ReadDirectory(abs);
                else return Files.push(abs);
            });
        } catch (e) {
            console.error(chalk.red(e.message))
            return
        }
    },

    convert_file_to_transaction: async (folder, array_files, array_address, endpoint) => {
        const dom = await JSDOM.fromFile(folder + "/index.html")

        var nodelist = dom.window.document.querySelectorAll('[src],[href]');

        for (let i = 0; i < nodelist.length; ++i) {
            var item = nodelist[i];


            for (let i = 0; i < array_files.length; i++) {

                if (String(item.getAttribute('src')).substring(String(item.getAttribute('src')).lastIndexOf('/') + 1) == (array_files[i].substring(array_files[i].lastIndexOf('/') + 1))) {
                    item.setAttribute('src', endpoint + "/api/last_transaction/" + array_address[i] + "/content?mime=" + mime.getType(array_files[i]))
                }

                if (String(item.getAttribute('href')).substring(String(item.getAttribute('href')).lastIndexOf('/') + 1) == (array_files[i].substring(array_files[i].lastIndexOf('/') + 1))) {
                    item.setAttribute('href', endpoint + "/api/last_transaction/" + array_address[i] + "/content?mime=" + mime.getType(array_files[i]))
                }
            }


        }

        data = dom.serialize()
        try {
            fs.writeFileSync(folder + "/index.html", data)

        } catch (err) {
            console.error(err)
        }
    },

    file_waitConfirmations: function (transaction, address, endpoint, file) {
        message = "Transaction Sent Successfully"
        archethic.waitConfirmations(transaction.address, endpoint,
            confirmationCallback(endpoint,address,message,file)
        )

    },

    folder_waitConfirmations: function (transaction, address, endpoint, file) {
       
        message = x + " deployed successfully"
        archethic.waitConfirmations(transaction.address, endpoint,
            confirmationCallback(endpoint,address,message,file)
        )

    },

    website_waitConfirmations: function (transaction, address, endpoint, file) {
       
        message = "Check your website at-"
        archethic.waitConfirmations(transaction.address, endpoint,
            confirmationCallback(endpoint,address,message,file)
        )

    }


}