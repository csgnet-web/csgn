import { useCallback, useEffect, useState } from 'react'

interface PhantomProvider {
  isPhantom?: boolean
  connect: (options?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toString: () => string } }>
  disconnect: () => Promise<void>
  signMessage?: (message: Uint8Array, encoding?: 'utf8') => Promise<{ signature: Uint8Array }>
}

declare global {
  interface Window { solana?: PhantomProvider }
}

const STORAGE_KEY = 'csgn_wallet_address'

function bytesToBase58(bytes: Uint8Array): string {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
  let digits = [0]
  for (const byte of bytes) {
    let carry = byte
    for (let i = 0; i < digits.length; i++) {
      const value = digits[i] * 256 + carry
      digits[i] = value % 58
      carry = Math.floor(value / 58)
    }
    while (carry) { digits.push(carry % 58); carry = Math.floor(carry / 58) }
  }
  for (const byte of bytes) { if (byte === 0) digits.push(0); else break }
  return digits.reverse().map((digit) => alphabet[digit]).join('')
}

export function usePhantomWallet() {
  const [walletAddress, setWalletAddress] = useState<string | null>(localStorage.getItem(STORAGE_KEY))
  const [balance, setBalance] = useState<number | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchBalance = useCallback(async (address: string) => {
    try {
      const response = await fetch('https://api.mainnet-beta.solana.com', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getBalance', params: [address] }) })
      const data = await response.json()
      setBalance((data?.result?.value ?? 0) / 1_000_000_000)
    } catch { setBalance(null) }
  }, [])

  const connect = useCallback(async (): Promise<string | null> => {
    setError(null)
    const provider = window.solana
    if (!provider?.isPhantom) { setError('Phantom wallet not detected. Install Phantom to continue.'); return null }
    setIsConnecting(true)
    try {
      const result = await provider.connect()
      const address = result.publicKey.toString()
      setWalletAddress(address)
      localStorage.setItem(STORAGE_KEY, address)
      await fetchBalance(address)
      return address
    } catch { setError('Unable to connect Phantom wallet right now.'); return null }
    finally { setIsConnecting(false) }
  }, [fetchBalance])

  const signMessage = useCallback(async (message: string): Promise<string | null> => {
    setError(null)
    const provider = window.solana
    if (!provider?.isPhantom || !provider.signMessage) { setError('Phantom message signing is unavailable.'); return null }
    try {
      const encoded = new TextEncoder().encode(message)
      const result = await provider.signMessage(encoded, 'utf8')
      return bytesToBase58(result.signature)
    } catch { setError('Please approve the Phantom signature request to verify your wallet.'); return null }
  }, [])

  const disconnect = useCallback(async () => {
    const provider = window.solana
    if (provider?.isPhantom) await provider.disconnect()
    setWalletAddress(null); setBalance(null); localStorage.removeItem(STORAGE_KEY)
  }, [])

  useEffect(() => { if (walletAddress) void fetchBalance(walletAddress) }, [walletAddress, fetchBalance])

  return { walletAddress, balance, isConnecting, error, connect, disconnect, signMessage, refreshBalance: () => walletAddress && fetchBalance(walletAddress) }
}
