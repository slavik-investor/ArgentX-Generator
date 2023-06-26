import { CLASS_HASH, PROXY_CLASS_HASH } from '@app/constants'
import { Wallet } from '@app/types'
import { getSpinner, loadWalletsSync, saveWalletsSync, sleep } from '@app/utils'
import * as bip39 from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english'
import { BigNumber, ethers } from 'ethers'
import { readFileSync } from 'fs'
import { CallData, ec, hash } from 'starknet'

type GeneratorOptions = {
  quantity?: number
  separator: string
  useMnemonicFile: boolean
}

export async function generator({ quantity, separator, useMnemonicFile }: GeneratorOptions) {
  const spinner = getSpinner()
  spinner.start()

  const wallets: Wallet[] = []

  if (useMnemonicFile) {
    const mnemonics = readFileSync('data/mnemonics.txt').toString().split('\n').map(row => row.trim()).filter(m => m)
    const exist = new Set(loadWalletsSync({ separator }).map(w => w.mnemonic))
    for (const mnemonic of mnemonics) {
      if (exist.has(mnemonic) === false) {
        await sleep(0)
        wallets.push(generate(mnemonic))
      }
    }
  } else {
    for (let i = 0; i < quantity; i++) {
      await sleep(0)
      const mnemonic = bip39.generateMnemonic(wordlist)
      wallets.push(generate(mnemonic))
    }
  }

  console.log(`Generated ${wallets.length} wallets`)

  await saveWalletsSync(wallets, { separator })
  spinner.stop()
}

export function generate(mnemonic: string): Wallet {
  const wallet = ethers.Wallet.fromMnemonic(mnemonic, `m/44'/60'/0'/0/0`)

  const hdNode = ethers.utils.HDNode.fromSeed(wallet.privateKey)
  const starknetHdNode = hdNode.derivePath(`m/44'/9004'/0'/0/0`)

  const privateKeyHex = `0x` + ec.starkCurve.grindKey(starknetHdNode.privateKey)
  const publicKey = ec.starkCurve.getStarkKey(privateKeyHex)

  const constructorCallData = CallData.compile({
    implementation: CLASS_HASH,
    selector: hash.getSelectorFromName('initialize'),
    calldata: CallData.compile({ signer: publicKey, guardian: '0' }),
  })

  const address = hash.calculateContractAddressFromHash(publicKey, PROXY_CLASS_HASH, constructorCallData, 0)

  return { mnemonic, address, privateKey: BigNumber.from(privateKeyHex).toString() }
}
