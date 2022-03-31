const chalk = require('chalk')
const figlet = require('figlet')

exports.command = 'about'

exports.describe = 'Welcome to AeWeb'

exports.handler = function () {
  console.log(chalk.green('\n', 'Hello and Welcome to AeWeb !', '\n'))
  console.log(chalk.blue(figlet.textSync('AEWEB', {
      font: "Alligator2"
  })))
  console.log(chalk.green('\n', 'Create your Website on top of Archethic Public Blockchain'))
  console.log(chalk.green('\n'))
}