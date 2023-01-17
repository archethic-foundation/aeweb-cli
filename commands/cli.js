import * as PathLib from 'path'
import fs from 'fs'
import parse from 'parse-gitignore'
import ignore from 'ignore'


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
  return PathLib.normalize(folderPath.endsWith(PathLib.sep) ? folderPath.slice(0, -1) : folderPath)
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

export function getFiles(folderPath, includeGitIgnoredFiles = false) {
  let files = []
  if (fs.statSync(folderPath).isDirectory()) {
    handleDirectory(folderPath, files, includeGitIgnoredFiles)

    files = files.map((file) => {
      file.filePath = file.filePath.replace(folderPath, '')
      return file
    })
  } else {
    const data = fs.readFileSync(folderPath)
    const file_path = PathLib.basename(folderPath)
    files.push({ "filePath": file_path, data })
  }

  return files
}

function handleDirectory(entry, files, includeGitIgnoredFiles) {
  let filters = []

  if (!includeGitIgnoredFiles) {
    let gitIgnoreFilePath = PathLib.join(entry, '.gitignore')
    console.log(gitIgnoreFilePath)

    if (fs.existsSync(gitIgnoreFilePath)) {
      filters = parse(fs.readFileSync(gitIgnoreFilePath))['patterns']
    }
  }
  filters.unshift('.gitignore')
  filters.unshift('.git')

  const isGitIgnored = ignore().add(filters)
  doHandleDirectory(entry, files, isGitIgnored)
}

function doHandleDirectory(entry, files, isGitIgnored) {
  // reduce search space by omitting folders at once
  if (fs.statSync(entry).isDirectory() && !isGitIgnored.ignores(entry)) {
    fs.readdirSync(entry).forEach((child) => {
      doHandleDirectory(entry + PathLib.sep + child, files, isGitIgnored)
    })
  } else {
    if (!isGitIgnored.ignores(entry)) {
      handleFile(entry, files, isGitIgnored);
    }
  }
}

function handleFile(file_path, files, isGitIgnored) {
  if (!isGitIgnored.ignores(file_path)) {
    const data = fs.readFileSync(file_path)
    files.push({ "filePath": file_path, data })
  }
}
