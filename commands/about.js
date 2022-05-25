import chalk from 'chalk'
import figlet from 'figlet'

const command = 'about'

const describe = 'Welcome to AeWeb'

const handler = function () {
  console.log(chalk.green('\n', 'Hello and Welcome to AeWeb !', '\n'))
  console.log(chalk.blue(figlet.textSync('AEWEB', {
      font: "Alligator2"
  })))
  console.log(chalk.green('\n', 'Create your Website on top of Archethic Public Blockchain'))
  console.log(chalk.green('\n'))
}

export default {
  command,
  describe,
  handler
}