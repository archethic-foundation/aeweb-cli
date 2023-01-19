import zlib from 'zlib'
import isEqual from 'lodash/isEqual.js'
import path from 'path'
import Archethic, { Crypto, Utils } from 'archethic'

const { aesEncrypt, ecEncrypt, randomSecretKey } = Crypto
const { uint8ArrayToHex } = Utils
import nativeCryptoLib from 'crypto'

// 3_145_728 represent the maximum size for a transaction
// 45_728 represent json tree size
const MAX_FILE_SIZE = 3_145_728 - 45_728
const AEWEB_VERSION = 1
const HASH_FUNCTION = 'sha1'

export default class AEWeb {
  constructor(archethic) {
    if (!(archethic instanceof Archethic)) {
      throw 'archethic is not an instance of Archethic'
    }
    this.archethic = archethic
    this.txsContent = []
    this.metaData = {}
  }

  addFile(naivePath, data) {
    const size = Buffer.byteLength(data)
    if (size === 0) return

    const hash = nativeCryptoLib.createHash(HASH_FUNCTION).update(data).digest('hex')
    const content = zlib.gzipSync(data).toString('base64url')

    const tabPath = naivePath.split(path.sep)
    if (tabPath[0] === '') tabPath.shift()
    const filePath = tabPath.join('/')

    this.metaData[filePath] = { hash: hash, size: size, encoding: 'gzip', addresses: [] }

    // Handle file over than Max size. The file is splitted in multiple transactions,
    // firsts parts take a full transaction, the last part follow the normal sized file construction
    if (content.length >= MAX_FILE_SIZE) {
      handleBigFile(this.txsContent, filePath, content)
    } else {
      handleNormalFile(this.txsContent, filePath, content)
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
    const { metaData, refContent } = getMetaData(this.txsContent, transactions, this.metaData, this.sslCertificate)
    this.metaData = metaData

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
    this.metaData = {}
  }
}

function handleBigFile(txsContent, filePath, content) {
  while (content.length > 0) {
    // Split the file
    const part = content.slice(0, MAX_FILE_SIZE)
    content = content.replace(part, '')
    // Set the value in transaction content
    const txContent = {
      content: {},
      size: part.length,
      refPath: [],
    }
    txContent.content[filePath] = part
    txContent.refPath.push(filePath)
    txsContent.push(txContent)
  }
}

function handleNormalFile(txsContent, filePath, content) {
  // 4 x "inverted commas + 1x :Colon + 1x ,Comma + 1x space = 7
  const fileSize = content.length + filePath.length + 7
  // Get first transaction content that can be filled with file content
  const txContent = getContentToFill(txsContent, fileSize)
  const index = txsContent.indexOf(txContent)

  txContent.content[filePath] = content
  txContent.refPath.push(filePath)
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

function getMetaData(txsContent, transactions, metaData, sslCertificate) {
  // For each transaction
  transactions.forEach((tx) => {
    if (!tx.address) throw 'Transaction is not built'

    const txContent = txsContent.find(val => isEqual(val.content, tx.data.content))

    if (!txContent) throw 'Transaction content not expected'
    // For each filePath
    const address = uint8ArrayToHex(tx.address)
    // Update the metadata at filePath with address
    return txContent.refPath.forEach((filePath) => {
      const { addresses } = metaData[filePath]
      addresses.push(address)
      metaData[filePath]['addresses'] = addresses
    })
  })

  metaData = sortObject(metaData)

  const ref = {
    aewebVersion: AEWEB_VERSION,
    hashFunction: HASH_FUNCTION,
    metaData: metaData
  }

  if (sslCertificate) {
    ref.sslCertificate = sslCertificate
  }

  return { metadata: metaData, refContent: JSON.stringify((ref)) }
}

function sortObject(obj) {
  return Object.keys(obj)
    .sort()
    .reduce(function (acc, key) {
      acc[key] = obj[key]
      return acc
    }, {})
}
