# ÆWeb

Welcome to the ÆWeb Cli repository ! This command line interface enables you to deploy files on top of ARCHEthic Public Blockchain.

Using this cli you can deploy a single page website


## Version

1.0.0


## Instructions

To generate address you need -
- `seed` is hexadecimal encoding or Uint8Array representing the transaction chain seed to be able to derive and generate the keys
- `index` is the number of transactions in the chain, to generate the actual and the next public key 
```bash
aeweb generate-address --seed=myseedphrase --index=0
```

To deploy files you need -
- `seed` is hexadecimal encoding or Uint8Array representing the transaction chain seed to be able to derive and generate the keys
- `index` is the number of transactions in the chain, to generate the actual and the next public key (see below the cryptography section)
- `endpoint` is the HTTP URL to node
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