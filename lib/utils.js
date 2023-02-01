import { Crypto, Utils } from 'archethic'
import nativeCryptoLib from 'crypto'
import * as PathLib from 'path'
import isEqual from 'lodash/isEqual.js'
const { uint8ArrayToHex } = Utils


// 3_145_728 represent the maximum size for a transaction
// 45_728 represent json tree size
// 3mb in binary 
export const MAX_FILE_SIZE = 3_145_728 - 45_728
export const AEWEB_VERSION = 1
export const HASH_FUNCTION = 'sha1'

export function getFilePath(naivePath) {
    const jsonPath = naivePath.split(PathLib.sep)
    if (jsonPath[0] === '') jsonPath.shift()
    return jsonPath.join('/');
}

export function hashContent(data) {
    return nativeCryptoLib.createHash(HASH_FUNCTION).update(data).digest('hex')
}

export function handleBigFile(txsContent, filePath, content) {
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

export function handleNormalFile(txsContent, filePath, content) {
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

export function getRefTxContent(txsContent, transactions, metaData, sslCertificate) {
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

    return JSON.stringify(ref);
}

function sortObject(obj) {
    return Object.keys(obj)
        .sort()
        .reduce(function (acc, key) {
            acc[key] = obj[key]
            return acc
        }, {})
}


