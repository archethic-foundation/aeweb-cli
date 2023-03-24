import zlib from 'zlib'
import Archethic, { Crypto } from 'archethic'
import {
  hashContent, getFilePath, MAX_FILE_SIZE, handleBigFile, handleNormalFile,
  getRefTxContent
} from "./utils.js"

const { aesEncrypt, ecEncrypt, randomSecretKey } = Crypto
export default class AEWeb {

  constructor(archethic, prevRefTxContent = undefined) {
    if (!(archethic instanceof Archethic)) {
      throw 'archethic is not an instance of Archethic'
    }

    if (prevRefTxContent !== undefined) this.prevRefTxMetaData = prevRefTxContent.metaData
    this.archethic = archethic
    this.txsContent = []
    this.metaData = {}
    this.modifiedFiles = []
  }

  addFile(naivePath, data) {
    const size = Buffer.byteLength(data)
    if (size === 0) return

    const hash = hashContent(data)
    const filePath = getFilePath(naivePath)

    if (this.prevRefTxMetaData !== undefined) {
      // A website update operation
      const prevFileMetaData = this.prevRefTxMetaData[filePath];
      delete (this.prevRefTxMetaData[filePath]);

      if (prevFileMetaData != undefined && prevFileMetaData["hash"] == hash) {
        // File exists and  not changed
        // priority given to new files/metadata
        this.metaData[filePath] = prevFileMetaData;
        return;
      }
    }
    // File has changed or is new
    this.modifiedFiles.push(filePath);

    this.metaData[filePath] = { hash: hash, size: size, encoding: 'gzip', addresses: [] }

    const content = zlib.gzipSync(data).toString('base64url')
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
    const refContent = getRefTxContent(this.txsContent, transactions, this.metaData, this.sslCertificate)

    const refTx = this.archethic.transaction.new()
      .setType('hosting')
      .setContent(refContent)

    if (this.sslKey) {
      const storageNoncePublicKey = await this.archethic.network.getStorageNoncePublicKey()
      const aesKey = randomSecretKey()
      const encryptedSecretKey = ecEncrypt(aesKey, storageNoncePublicKey)
      const encryptedSslKey = aesEncrypt(this.sslKey, aesKey)

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

  listModifiedFiles() {
    return this.modifiedFiles;
  }

  listRemovedFiles() {
    return Object.keys(this.prevRefTxMetaData);
  }
}

