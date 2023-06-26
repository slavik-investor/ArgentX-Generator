import { CSV_HEADER } from '@app/constants'
import { Wallet } from '@app/types'
import { existsSync, readFileSync, writeFileSync } from 'fs'

export function loadWalletsSync({ separator = ',' } = {}): Wallet[] {
  if (existsSync('data/wallets.csv') === false) {
    return []
  }

  return readFileSync('data/wallets.csv').toString()
    .split('\n')
    .slice(1)
    .filter(row => row)
    .map(row => row.trim())
    .map(row => row.split(separator))
    .map(row => ({
      mnemonic: row[0],
      address: row[1],
      privateKey: row[2],
    }))
}

export async function saveWalletsSync(wallets: Wallet[], { replace = false, separator = ',' } = {}) {
  const rows = [ CSV_HEADER.join(separator) ]

  wallets = replace ? wallets : [ ...loadWalletsSync({ separator }), ...wallets ]
  rows.push(...wallets.map(w => [ w.mnemonic, w.address, w.privateKey ].join(separator)))

  writeFileSync('data/wallets.csv', rows.join('\n'))
}


export function getSpinner() {
  const chars = [ '⠙', '⠘', '⠰', '⠴', '⠤', '⠦', '⠆', '⠃', '⠋', '⠉' ]

  let interval: NodeJS.Timeout
  let x = 0
  let m = ''

  const start = (message = '') => {
    if (interval === undefined) {
      interval = setInterval(() => {
        m = message
        process.stdout.write('\r' + message + chars[x++].padStart(3))
        x = x % chars.length
      }, 100)
    }
  }

  const stop = () => {
    if (interval !== undefined) {
      clearInterval(interval)
      process.stdout.write('\r'.padEnd(m.length + 10) + '\r')
    }
  }

  return { start, stop }
}

export async function sleep(time: number) {
  const spinner = time > 1 ? getSpinner() : null
  const timeout = new Promise(resolve => setTimeout(resolve, time * 1000))
  spinner?.start(`sleep for ${time}s`)
  await timeout
  spinner?.stop()
}

export function random(min: number, max: number) {
  return Math.round(Math.random() * (max - min)) + min
}
