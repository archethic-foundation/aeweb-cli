# AEWeb

This is AEWeb Cli repository! 

This command line interface enables you to deploy files/ websites / folders (.jpg, .png, .pdf, .html, etc...) on top of Archethic Public Blockchain.


## Instructions

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
aeweb generate-address --seed=myseedphrase --index=0
```

To deploy files, folder or website -
- `seed` is a string representing the transaction chain entropy to be able to derive and generate the keys
- `endpoint` is the URL of a welcome node to receive the transaction
- `path` is the path of the folder or file you want to deploy
```bash
aeweb deploy --seed=myseedphrase --endpoint=https://testnet.archethic.net --path=./website
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
