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

export function getFiles(folderPath, isGitFolder=false) {

  let files = []
  let filters = []
  
  // if the folder is git folder then we should ignore 
  // .git and files / folders in gitignore
  if (isGitFolder){
    
    if (fs.existsSync('.gitignore')) {
      filters = parse(fs.readFileSync('.gitignore'))['patterns'];
    } 
    
    filters.push('.git/')
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
    if(!gitignore.ignores(path.join(entry))){
      handleFile(entry, files);
    }
  }
}

function handleFile(path, files) {
  const data = fs.readFileSync(path)
  files.push({ path, data })
}