import { CLASS_HASH, ETH_ABI, ETH_ADDRESS, PROXY_CLASS_HASH } from '@app/constants'
import { Wallet } from '@app/types'
import { loadWalletsSync, random, saveWalletsSync, sleep } from '@app/utils'
import { BigNumber, ethers } from 'ethers'
import { Account, CallData, constants, Contract, ec, hash, Provider, uint256 } from 'starknet'

const RPC = ''                                      // leave empty string to use default rpc
const MAX_RETRY = 5                                 // max retry to deploy account
const SLEEP_BETWEEN_TRY = [ 30, 50 ] as const       // sleep time between try
const SLEEP_BETWEEN_WALLET = [ 30, 50 ] as const    // sleep time between wallet

export async function deployer(separator: string) {
  const wallets = loadWalletsSync({ separator })

  if (wallets.length === 0) {
    console.log('no wallet to deploy')
    return
  } else {
    console.log(`deploying ${wallets.length} wallets`)
  }

  const baseProvider = new Provider({ sequencer: { network: constants.NetworkName.SN_MAIN } })
  const customProvider = RPC ? new Provider({ rpc: { nodeUrl: RPC } }) : baseProvider

  const ETH = new Contract(ETH_ABI, ETH_ADDRESS, baseProvider)

  async function getBalance(wallet: Wallet) {
    const rawBalance = await ETH.balanceOf(wallet.address)
    return BigNumber.from(uint256.uint256ToBN(rawBalance.balance).toString())
  }

  for (let i = 0; i < wallets.length; i++) {
    try {
      const wallet = wallets[i]
      const balance = await getBalance(wallet)

      if (balance.lt(ethers.utils.parseEther('0.0001'))) {
        console.log(`${wallet.address} has ${ethers.utils.formatEther(balance)} ETH (< 0.0001 ETH), skip`)
        await sleep(0.5)
        continue
      }

      const code = await baseProvider.getCode(wallet.address)
      if (code.bytecode.length > 0) {
        console.log(`${wallet.address} has ${ethers.utils.formatEther(balance)} ETH, already deployed`)
        await sleep(0.5)
        continue
      }

      console.log(`${wallet.address} has ${ethers.utils.formatEther(balance)} ETH, deploy`)

      const privateKeyHex = BigNumber.from(wallet.privateKey).toHexString()
      const publicKeyHex = ec.starkCurve.getStarkKey(privateKeyHex)

      const account = new Account(customProvider, wallet.address, privateKeyHex)

      const constructorCallData = CallData.compile({
        implementation: CLASS_HASH,
        selector: hash.getSelectorFromName('initialize'),
        calldata: CallData.compile({ signer: publicKeyHex, guardian: '0' }),
      })

      const deployAccountPayload = {
        classHash: PROXY_CLASS_HASH,
        constructorCalldata: constructorCallData,
        contractAddress: account.address,
        addressSalt: publicKeyHex,
      }

      for (let j = 0; j < MAX_RETRY; j++) {
        console.log(`attempt ${j + 1} to deploy account`)
        try {
          const { transaction_hash, contract_address } = await account.deployAccount(deployAccountPayload)
          console.log(`account deployed with transaction hash ${transaction_hash} and contract address ${contract_address}`)
          break
        } catch (e) {
          console.error(`error: ${e?.message}`)
          await sleep(random(...SLEEP_BETWEEN_TRY))
        }
      }

      await saveWalletsSync(wallets, { replace: true, separator })

      if (i !== 0 && i !== wallets.length - 1) {
        await sleep(random(...SLEEP_BETWEEN_WALLET))
      }
    } catch (e) {
      console.error(e)
    }
  }
}


