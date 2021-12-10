# ÆWeb

Welcome to the ÆWeb Cli repository ! This command line interface enables you to deploy files on top of ARCHEthic Public Blockchain.

Using this cli you can deploy a single page website

## Instructions

To get the ÆWeb CLI, you need NodeJS installed. Then you need to install the CLI, using:
```bash
npm install aeweb -g
```

To generate address you need -
- `seed` is a string representing the transaction chain entropy to be able to derive and generate the keys for the transactions
- `index` is the number of transactions in the chain, to generate the current and the next public key 
```bash
aeweb generate-address --seed=myseedphrase --index=0
```

To deploy files you need -
- `seed` is a string representing the transaction chain entropy to be able to derive and generate the keys
- `index` is the number of transactions in the chain, to generate the current and the next public key 
- `endpoint` is the URL of a welcome node to receive the transaction
- `path` is the file path
```bash
aeweb deploy-file --seed=myseedphrase --index=0 --endpoint=https://testnet.archethic.net --path=./index.html
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
