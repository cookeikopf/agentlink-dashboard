import { appendFileSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'

const AUDIT_LOG = '/root/.openclaw/secrets/wallets/audit.log'

/**
 * Log a wallet action
 */
export function logAction(action, details = {}) {
  const timestamp = new Date().toISOString()
  const entry = {
    timestamp,
    action,
    ...details
  }
  
  const logLine = `[${timestamp}] ${action}` +
    (details.wallet ? ` | Wallet: ${details.wallet}` : '') +
    (details.address ? ` | Address: ${details.address}` : '') +
    (details.network ? ` | Network: ${details.network}` : '') +
    (details.txHash ? ` | Tx: ${details.txHash}` : '') +
    (details.amount ? ` | Amount: ${details.amount}` : '') +
    '\n'
  
  appendFileSync(AUDIT_LOG, logLine)
  
  // Also log to console for immediate visibility
  console.log('📝 Audit:', action, details.wallet || '')
}

/**
 * Read audit log
 */
export function readAuditLog(lines = 50) {
  if (!existsSync(AUDIT_LOG)) {
    return []
  }
  
  const content = readFileSync(AUDIT_LOG, 'utf8')
  return content.trim().split('\n').slice(-lines)
}

/**
 * Log wallet creation
 */
export function logWalletCreated(name, address, network) {
  logAction('WALLET_CREATED', {
    wallet: name,
    address,
    network
  })
}

/**
 * Log transaction
 */
export function logTransaction(wallet, txHash, type, amount = null) {
  logAction('TRANSACTION', {
    wallet,
    txHash,
    type,
    amount
  })
}

/**
 * Log balance check
 */
export function logBalanceCheck(address, balance, network) {
  logAction('BALANCE_CHECK', {
    address,
    balance,
    network
  })
}

/**
 * Log error
 */
export function logError(action, error, details = {}) {
  logAction('ERROR', {
    action,
    error: error.message || error,
    ...details
  })
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2]
  
  switch (command) {
    case 'show':
      const lines = parseInt(process.argv[3]) || 50
      console.log(`📋 Last ${lines} audit entries:`)
      console.log('')
      const entries = readAuditLog(lines)
      entries.forEach(e => console.log(e))
      break
      
    default:
      console.log('Wallet Guardian - Audit Log')
      console.log('')
      console.log('Commands:')
      console.log('  show [lines]   - Show recent audit entries')
  }
}
