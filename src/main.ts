import { deployer } from '@app/actions/deploy'
import { generator } from '@app/actions/generator'
import { prompt } from 'inquirer'

export async function main() {
  console.log('ArgentX wallets generator')

  const { action } = await prompt([ { type: 'list', name: 'action', message: 'What to do?', choices: [ 'Generate', 'Deploy' ] } ])
  const { separator } = await prompt([ { type: 'input', name: 'separator', message: 'CSV separator', default: ';' } ])

  if (action === 'Generate') {
    const { useMnemonicFile } = await prompt([ { type: 'list', name: 'useMnemonicFile', message: 'Use mnemonics from the mnemonics.txt?', choices: [ 'Yes', 'No' ] } ])
    if (useMnemonicFile === 'Yes') {
      await generator({ separator, useMnemonicFile: true })
    } else {
      const { quantity } = await prompt([ { type: 'input', name: 'quantity', message: 'How many?', default: 100 } ])
      await generator({ quantity, separator, useMnemonicFile: false })
    }
  }

  if (action === 'Deploy') {
    await deployer(separator)
  }
}
