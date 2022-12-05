import zlib from 'zlib'
import set from 'lodash/set.js'
import update from 'lodash/update.js'
import isEqual from 'lodash/isEqual.js'
import path from 'path'
import Archethic, { Crypto, Utils } from 'archethic'

const { aesEncrypt, ecEncrypt, randomSecretKey } = Crypto
const { uint8ArrayToHex } = Utils

// 3_145_728 represent the maximum size for a transaction
// 45_728 represent json tree size
const MAX_FILE_SIZE = 3_145_728 - 45_728

// HASH_FUNCTION this must retreived from the archethic libjs
const HASH_FUNCTION = 'sha-1'


export default class AEWeb {
    // TODO:
    // Protocol Version should be collected from archethic libjs.
    // Arcethic-libjs will query{version} to node.
    // Must be set during object instantiation.
    static PROTOCOL_VERSION = 1

    constructor(archethic) {
        if (!(archethic instanceof Archethic)) {
            throw 'archethic is not an instance of Archethic'
        }
        this.archethic = archethic
        this.txsContent = []
        this.metaData = new Map();
    }

    addMetaData(jsonPath, hash, size) {
        this.metaData.set(jsonPath.join(path.sep), {
            hash: hash,
            size: size
        });
    }

    getMetaData(jsonPath) {
        return this.metaData.get(jsonPath.join(path.sep))
    }

    addFile({
        path: filePath,
        data,
        hash,
        size
    }) {
        let content = zlib.gzipSync(data).toString('base64url')

        const jsonPath = filePath.split(path.sep)
        // ['', 'README.md'] -> ['README.md']
        if (jsonPath[0] === '') jsonPath.shift()
        this.addMetaData(jsonPath, hash, size)

        // Handle file over than Max size. The file is splited in multiple transactions,
        // firsts parts take a full transaction, the last part follow the normal sized file construction
        if (content.length >= MAX_FILE_SIZE) {
            handleBigFile(this.txsContent, jsonPath, content)
        } else {
            handleNormalFile(this.txsContent, jsonPath, content)
        }
    }

    addSSLCertificate(sslCertificate, sslKey) {
        this.sslCertificate = sslCertificate
        this.sslKey = sslKey
    }

    getFilesTransactions() {
        return this.txsContent.map(txContent => {
            const tx = this.archethic.transaction.new()
                .setType('hosting')
                .setContent(JSON.stringify(txContent.content))

            const index = this.txsContent.indexOf(txContent)
            txContent.content = tx.data.content
            this.txsContent.splice(index, 1, txContent)

            return tx
        })
    }

    async getRefTransaction(transactions) {
        const refContent = this.getRefContent(this.txsContent, transactions, this.sslCertificate)
        const refTx = this.archethic.transaction.new()
            .setType('hosting')
            .setContent(refContent)

        if (this.sslKey) {
            const storageNoncePublicKey = await this.archethic.network.getStorageNoncePublicKey()
            const aesKey = randomSecretKey()
            const encryptedSecretKey = ecEncrypt(aesKey, storageNoncePublicKey)
            const encryptedSslKey = aesEncrypt(this.sslConfiguration.key, aesKey)

            refTx.addOwnership(encryptedSslKey, [{
                publicKey: storageNoncePublicKey,
                encryptedSecretKey: encryptedSecretKey
            }])
        }

        return refTx
    }

    getRefContent(txsContent, transactions, sslCertificate) {
        // For each transaction
        const ref = transactions.reduce((refContent, tx) => {
            if (!tx.address) throw 'Transaction is not built'

            const txContent = txsContent.find(val => isEqual(val.content, tx.data.content))

            if (!txContent) throw 'Transaction content not expected'

            const address = uint8ArrayToHex(tx.address)
            // For each jsonPath

            return txContent.refPath.reduce((acc, jsonPath) => {

                const {
                    hash,
                    size
                } = this.getMetaData(jsonPath)

                // Update the reference content at jsonPath with address
                return update(acc, jsonPath, currentAddresses => {
                    if (currentAddresses) {
                        currentAddresses.addresses.push(address)
                        return currentAddresses
                    } else {
                        return {
                            encoding: 'gzip',
                            hash: hash,
                            size: size,
                            addresses: [address]
                        }
                    }
                })
            }, refContent)
        }, {})

        if (sslCertificate) {
            ref.sslCertificate = sslCertificate
        }

        const refContent = {
            "aewebVersion": AEWeb.PROTOCOL_VERSION,
            "hashFunction": HASH_FUNCTION,
            "metaData": ref,
        }

        return JSON.stringify(refContent)
    }


    reset() {
        this.txsContent = []
        this.sslCertificate = undefined
        this.sslKey = undefined
    }
};

function handleBigFile(txsContent, jsonPath, content) {
    while (content.length > 0) {
        // Split the file
        const part = content.slice(0, MAX_FILE_SIZE)
        content = content.replace(part, '')
        // Set the value in transaction content
        const txContent = {
            content: {},
            size: part.length,
            refPath: []
        }
        set(txContent.content, jsonPath, part)
        txContent.refPath.push(jsonPath)

        txsContent.push(txContent)
    }
}

function handleNormalFile(txsContent, jsonPath, content) {
    const fileSize = content.length

    // Get first transaction content that can be filled with file content
    const txContent = getContentToFill(txsContent, fileSize)
    const index = txsContent.indexOf(txContent)
    // Set the value in transaction content
    set(txContent.content, jsonPath, content)
    txContent.refPath.push(jsonPath)

    txContent.size += fileSize

    if (index === -1) {
        // Push new transaction
        txsContent.push(txContent)
    } else {
        // Update existing transaction
        txsContent.splice(index, 1, txContent)
    }
}

function getContentToFill(txsContent, contentSize) {

    const content = txsContent.find(txContent => (txContent.size + contentSize) <= MAX_FILE_SIZE)

    if (content) {
        return content
    } else {
        return {
            content: {},
            size: 0,
            refPath: []
        }
    }
}
