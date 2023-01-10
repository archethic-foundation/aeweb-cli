import path from 'path'
import fs from 'fs'
import ignore from 'ignore'
import parse from 'parse-gitignore'

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

export function getFiles(folderPath, includeGitIgnoredFiles=false) {

  let files = []
  let filters = ['.git/']
  
  // if we don't want to include git ignored files, we add filters
  if (!includeGitIgnoredFiles){
    if (fs.existsSync('.gitignore')) {
      filters.push(...parse(fs.readFileSync('.gitignore'))['patterns']);
    } 
  }
  
  if (fs.statSync(folderPath).isDirectory()) {
    handleDirectory(folderPath, files, filters)
    files = files.map(file => {
      file.path = file.path.replace(folderPath, '')
      return file
    })
  } else {
    const data = fs.readFileSync(folderPath)
    const path = path.basename(folderPath)
    files.push({ path, data })
  }

  return files
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

function handleDirectory(entry, files, filters ) {
  const gitignore = ignore().add(filters)
  if (fs.statSync(entry).isDirectory()) {
    fs.readdirSync(entry).forEach(child => {
      handleDirectory(entry + path.sep + child, files, filters)
    });
  } else {
    // check if file's pattern corresponds to gitignore patterns
    const absolutePath = getAbsolutePath(entry)
    if(!gitignore.ignores(absolutePath)){
      handleFile(entry, files);
    }
  }
}

function handleFile(path, files) {
  const data = fs.readFileSync(path)
  files.push({ path, data })
}

function getAbsolutePath(entryPath) {
  var absolutePath = path.join(entryPath)

  if (absolutePath.startsWith(`..${path.sep}`)) return absolutePath.substr(3)
  if (absolutePath.startsWith(`${path.sep}`)) return absolutePath.substr(1)

  return absolutePath;
}