import { useCallback, useEffect, useState } from 'react'

interface PhantomProvider {
  isPhantom?: boolean
  connect: (options?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toString: () => string } }>
  disconnect: () => Promise<void>
}

declare global {
  interface Window {
    solana?: PhantomProvider
  }
}

const STORAGE_KEY = 'csgn_wallet_address'

export function usePhantomWallet() {
  const [walletAddress, setWalletAddress] = useState<string | null>(localStorage.getItem(STORAGE_KEY))
  const [balance, setBalance] = useState<number | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchBalance = useCallback(async (address: string) => {
    try {
      const response = await fetch('https://api.mainnet-beta.solana.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getBalance', params: [address] }),
      })
      const data = await response.json()
      const lamports = data?.result?.value ?? 0
      setBalance(lamports / 1_000_000_000)
    } catch {
      setBalance(null)
    }
  }, [])

  const connect = useCallback(async () => {
    setError(null)
    const provider = window.solana
    if (!provider?.isPhantom) {
      setError('Phantom wallet not detected. Install Phantom to continue.')
      return
    }

    setIsConnecting(true)
    try {
      const result = await provider.connect()
      const address = result.publicKey.toString()
      setWalletAddress(address)
      localStorage.setItem(STORAGE_KEY, address)
      await fetchBalance(address)
    } catch {
      setError('Unable to connect Phantom wallet right now.')
    } finally {
      setIsConnecting(false)
    }
  }, [fetchBalance])

  const disconnect = useCallback(async () => {
    const provider = window.solana
    if (provider?.isPhantom) await provider.disconnect()
    setWalletAddress(null)
    setBalance(null)
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  useEffect(() => {
    if (!walletAddress) return
    fetchBalance(walletAddress)
  }, [walletAddress, fetchBalance])

  return { walletAddress, balance, isConnecting, error, connect, disconnect, refreshBalance: () => walletAddress && fetchBalance(walletAddress) }
}
