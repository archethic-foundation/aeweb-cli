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

export default class AEWeb {
  constructor(archethic) {
    if (!(archethic instanceof Archethic)) {
      throw 'archethic is not an instance of Archethic'
    }

    this.archethic = archethic
    this.txsContent = []
  }

  addFile(filePath, data) {
    let content = zlib.gzipSync(data).toString('base64url')

    const jsonPath = filePath.split(path.sep)
    if (jsonPath[0] === '') jsonPath.shift()
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
    const refContent = getRefContent(this.txsContent, transactions, this.sslCertificate)

    const refTx = this.archethic.transaction.new()
      .setType('hosting')
      .setContent(refContent)

    if (this.sslKey) {
      const storageNoncePublicKey = await this.archethic.network.getStorageNoncePublicKey()
      const aesKey = randomSecretKey()
      const encryptedSecretKey = ecEncrypt(aesKey, storageNoncePublicKey)
      const encryptedSslKey = aesEncrypt(this.sslConfiguration.key, aesKey)

      refTx.addOwnership(encryptedSslKey, [{ publicKey: storageNoncePublicKey, encryptedSecretKey: encryptedSecretKey }])
    }

    return refTx
  }

  reset() {
    this.txsContent = []
    this.sslCertificate = undefined
    this.sslKey = undefined
  }
}

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

function getRefContent(txsContent, transactions, sslCertificate) {
  // For each transaction
  const ref = transactions.reduce((refContent, tx) => {
    if (!tx.address) throw 'Transaction is not built'

    const txContent = txsContent.find(val => isEqual(val.content, tx.data.content))

    if (!txContent) throw 'Transaction content not expected'

    const address = uint8ArrayToHex(tx.address)
    // For each jsonPath
    return txContent.refPath.reduce((acc, jsonPath) => {
      // Update the reference content at jsonPath with address
      return update(acc, jsonPath, currentAddresses => {
        if (currentAddresses) {
          currentAddresses.address.push(address)
          return currentAddresses
        } else {
          return {
            encodage: 'gzip',
            address: [address]
          }
        }
      })
    }, refContent)
  }, {})

  if (sslCertificate) {
    ref.sslCertificate = sslCertificate
  }

  return JSON.stringify(ref)
}