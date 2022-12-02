import path from 'path'
import fs from 'fs'
import Crypto from 'crypto'

// HASH_FUNCTION this must retrieved from the archethic libjs
const HASH_FUNCTION = 'sha-1'

export function getSeeds(baseSeed) {
  return {
    refSeed: baseSeed + 'aeweb_ref',
    filesSeed: baseSeed + 'aeweb_files'
  }
}


export function loadSSL(sslCertificateFile, sslKeyFile) {
  const sslConfiguration = {}

  if (sslCertificateFile !== undefined) {
    sslConfiguration.cert = fs.readFileSync(sslCertificateFile, 'utf8')
  }

  if (sslKeyFile !== undefined) {
    sslConfiguration.key = fs.readFileSync(sslKeyFile, 'utf8')
  }

  return sslConfiguration
}

export function normalizeFolderPath(folderPath) {
  return path.normalize(folderPath.endsWith(path.sep) ? folderPath.slice(0, -1) : folderPath)
}

export async function estimateTxsFees(archethic, transactions) {
  const slippage = 1.01

  let transactionsFees = transactions.map(tx => {
    return new Promise(async (resolve, reject) => {
      const { fee } = await archethic.transaction.getTransactionFee(tx)
      resolve(fee)
    })
  })

  transactionsFees = await Promise.all(transactionsFees)

  // Last transaction of the list is the reference transaction
  const fee = transactionsFees.pop()
  const refTxFees = Math.trunc(fee * slippage)

  let filesTxFees = transactionsFees.reduce((total, fee) => total += fee, 0)
  filesTxFees = Math.trunc(filesTxFees * slippage)

  return { refTxFees, filesTxFees }
}

export function getFiles(folderPath) {
  let files = []
  if (fs.statSync(folderPath).isDirectory()) {
    handleDirectory(folderPath, files)

    files = files.map(file => {
      file.path = file.path.replace(folderPath, '')
      return file
    })
  } else {
    handleFile(path.basename(folderPath), files);
  }
  return files
}

function handleDirectory(entry, files) {
  if (fs.statSync(entry).isDirectory()) {
    fs.readdirSync(entry).forEach(child => {
      handleDirectory(entry + path.sep + child, files)
    });
  } else {
    handleFile(entry, files)
  }
}

function handleFile(path, files) {
  const data = fs.readFileSync(path)
  const size = Math.floor(Buffer.byteLength(data) / 1024);
  const hash = Crypto.createHash(HASH_FUNCTION).update(data).digest('hex');
  files.push({ path, data, hash, size });
}
