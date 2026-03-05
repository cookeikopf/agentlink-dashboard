import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'

const SECRETS_DIR = '/root/.openclaw/secrets/wallets'
const INDEX_FILE = join(SECRETS_DIR, 'index.json')

// Ensure directory exists
try {
  mkdirSync(SECRETS_DIR, { recursive: true })
} catch {}

/**
 * Get or create encryption key from environment
 * In production, this should use OS keychain
 */
function getEncryptionKey() {
  const envKey = process.env.WALLET_ENCRYPTION_KEY
  if (envKey) {
    return Buffer.from(envKey, 'hex')
  }
  // Generate a key from a fixed salt + machine-specific data
  // This is a fallback - better to use OS keychain
  const salt = 'agentlink-wallet-salt-v1'
  return scryptSync(salt, 'agentlink', 32)
}

/**
 * Encrypt data using AES-256-GCM
 */
export function encrypt(text) {
  const key = getEncryptionKey()
  const iv = randomBytes(16)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  
  const authTag = cipher.getAuthTag()
  
  return {
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    data: encrypted
  }
}

/**
 * Decrypt data using AES-256-GCM
 */
export function decrypt(encryptedData) {
  const key = getEncryptionKey()
  const decipher = createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(encryptedData.iv, 'hex')
  )
  
  decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'))
  
  let decrypted = decipher.update(encryptedData.data, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  
  return decrypted
}

/**
 * Save wallet securely
 */
export function saveWallet(name, address, privateKey, metadata = {}) {
  const encryptedKey = encrypt(privateKey)
  
  const walletData = {
    name,
    address,
    encryptedKey,
    createdAt: new Date().toISOString(),
    ...metadata
  }
  
  writeFileSync(
    join(SECRETS_DIR, `${name}.json`),
    JSON.stringify(walletData, null, 2)
  )
  
  // Update index
  let index = { wallets: [] }
  if (existsSync(INDEX_FILE)) {
    index = JSON.parse(readFileSync(INDEX_FILE, 'utf8'))
  }
  
  index.wallets.push({
    name,
    address,
    createdAt: walletData.createdAt,
    network: metadata.network || 'unknown',
    purpose: metadata.purpose || 'unspecified'
  })
  
  writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2))
  
  return { success: true, address }
}

/**
 * Load wallet (returns address only by default)
 */
export function loadWallet(name, includePrivateKey = false) {
  const walletFile = join(SECRETS_DIR, `${name}.json`)
  
  if (!existsSync(walletFile)) {
    return null
  }
  
  const walletData = JSON.parse(readFileSync(walletFile, 'utf8'))
  
  if (includePrivateKey) {
    return {
      ...walletData,
      privateKey: decrypt(walletData.encryptedKey)
    }
  }
  
  // Return without private key by default
  const { encryptedKey, ...safeData } = walletData
  return safeData
}

/**
 * List all wallets (safe - no keys)
 */
export function listWallets() {
  if (!existsSync(INDEX_FILE)) {
    return []
  }
  
  const index = JSON.parse(readFileSync(INDEX_FILE, 'utf8'))
  return index.wallets
}

/**
 * Get private key (use with caution!)
 */
export function getPrivateKey(name) {
  const wallet = loadWallet(name, true)
  return wallet?.privateKey || null
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2]
  
  switch (command) {
    case 'list':
      console.log('📋 Saved Wallets:')
      const wallets = listWallets()
      wallets.forEach(w => {
        console.log(`  - ${w.name}: ${w.address} (${w.network})`)
      })
      if (wallets.length === 0) {
        console.log('  (none)')
      }
      break
      
    case 'show':
      const name = process.argv[3]
      if (!name) {
        console.error('Usage: node wallet-store.mjs show <name>')
        process.exit(1)
      }
      const wallet = loadWallet(name)
      if (wallet) {
        console.log('🔐 Wallet:', wallet.name)
        console.log('📍 Address:', wallet.address)
        console.log('🕐 Created:', wallet.createdAt)
        console.log('🌐 Network:', wallet.network)
        console.log('📝 Purpose:', wallet.purpose)
      } else {
        console.log('❌ Wallet not found:', name)
      }
      break
      
    default:
      console.log('Wallet Guardian - Secure Storage')
      console.log('')
      console.log('Commands:')
      console.log('  list           - List all wallets')
      console.log('  show <name>    - Show wallet details (no key)')
      console.log('')
      console.log('Private keys are encrypted and never shown by default.')
  }
}
