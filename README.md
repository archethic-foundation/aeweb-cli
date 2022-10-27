# AEWeb

This is AEWeb repository!

This command line interface enables you to deploy files/ websites / folders (.jpg, .png, .pdf, .html, etc...) on top of Archethic Public Blockchain.

It also provide an API to format files content according to Archethic web hosting API.

## Instructions

### CLI

To get the AEWeb CLI, you need NodeJS (latest version) installed. Then you need to install the CLI, using:

```bash
npm install aeweb -g
```

To check if AEWeb CLI is installed successfully, try :

```bash
aeweb about
```

To generate address you need -

- `seed` is a string representing the transaction chain entropy to be able to derive and generate the keys for the transactions
- `index` is the number of transactions in the chain, to generate the current and the next public key

```bash
aeweb generate-address --seed myseedphrase --index 0
```

To deploy files, folder or website -

- `seed` is a string representing the transaction chain entropy to be able to derive and generate the keys
- `endpoint` is the URL of a welcome node to receive the transaction
- `path` is the path of the folder or file you want to deploy

```bash
aeweb deploy --seed myseedphrase --endpoint https://testnet.archethic.net --path ./website
```

To enable SSL certificates and HTTPS websites you can need -

- `ssl-certificate` PEM file of the public certificate for your domain
- `ssl-key` PEM file of the private key related to your certificate for your domain (The key will be encrypted for the Archethic nodes - so only them would be able to decrypt it to deliver your website in HTTPS)

```bash
aeweb deploy --seed myseedphrase --endpoint https://testnet.archethic.net --path ./website --ssl-certificate example-com-cert.pem --ssl-key example-com-key.pem
```

### API

First you need to instanciate an AEWeb object with a instance of `Archethic` from [libjs](https://github.com/archethic-foundation/libjs)

```js
import AEWeb from 'aeweb'
import Archethic from 'archethic'

const archethic = new Archethic('http://mainnet.archethic.net')

const aeweb = new AEWeb(archethic)
```

#### addFile(filePath, data)

This function compress the file in gzip format and create one or multiple content structure for the transactions

- `filePath` is the path of the file from the root directory
- `data` is the content of the file

For a folder containing these files
```
root_folder
│   index.html
│   app.js
│
└───assets
│   │   image.png
```
The `filePath` parameter should be `index.html`, `app.js` and `assets/image.png`

```js
const aeweb = new AEWeb(archethic)
const data = readFile(filePath)

aeweb.addFile(filePath, data)
```

#### getFilesTransactions()

This function returns an array of the files transactions (see [AEWeb documentation](https://archethic-foundation.github.io/archethic-docs/participate/aeweb/how-it-works) for more details). Transaction are instance of libjs transaction (`archethic.transaction.new()`). These transactions need to be signed.

An empty array is returned if no transaction can be created.

```js
const aeweb = new AEWeb(archethic)
// Use aeweb.addFile for each needed file
const transactions = aeweb.getFilesTransactions()

transactions.forEach(tx => {
  tx.build(seed, index).originSign(originPrivateKey)
})

```

#### getRefTransaction(transactions)

This function returns the reference transaction (see [AEWeb documentation](https://archethic-foundation.github.io/archethic-docs/participate/aeweb/how-it-works) for more details). This transaction needs to be signed.

- `transactions` is an array of the files transactions previously signed.

This function is asynchronous and return a Promise

```js
const archethic = new Archethic()
const aeweb = new AEWeb(archethic)
// Use aeweb.addFile for each needed file
// Get transactions with aeweb.getFilesTransactions() and sign them
const refTx = await aeweb.getRefTransaction(transactions)

refTx.build(seed, index).originSign(originPrivateKey)
```

#### addSSLCertificate(sslCertificate, sslKey)

This function add the SSL certificate in the content and the SSL key in the secret in the reference transaction. This function needs to be called before **getRefTransaction**

- `sslCerticate` is the SSL certificate
- `sslKey` is the SSL private key

```js
const aeweb = new AEWeb(archethic)

const sslCertificate = getSSLCertificate()
const sslKey = getSSLKey()

aeweb.addSSLCertificate(sslCertificate, sslKey)
```

#### reset()

This function clear all data stored in AEWeb instance (files data and SSL certificate / key)

```js
const aeweb = new AEWeb(archethic)

aeweb.reset()
```

## Contribution

Thank you for considering to help out with the source code.
We welcome contributions from anyone and are grateful for even the smallest of improvement.

Please to follow this workflow:

1. Fork it!
2. Create your feature branch (git checkout -b my-new-feature)
3. Commit your changes (git commit -am 'Add some feature')
4. Push to the branch (git push origin my-new-feature)
5. Create new Pull Request

## Licence

AGPL
