/**
 * AgentLink Payment Test Script - KORRIGIERT für USDC (6 decimals)
 * 
 * Dieses Script testet Zahlungen zwischen Agenten über den PaymentRouter.
 * Voraussetzung: USDC muss in den Wallets vorhanden sein.
 */

import { createPublicClient, createWalletClient, http, parseUnits, formatUnits } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { baseSepolia } from 'viem/chains'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { createDecipheriv, scryptSync } from 'crypto'

const SECRETS_DIR = '/root/.openclaw/secrets/wallets'
const AUDIT_LOG = join(SECRETS_DIR, 'audit.log')

// Contract Adressen
const PAYMENT_ROUTER = '0x116f7A6A3499fE8B1Ffe41524CCA6573C18d18fF'
const USDC = '0x036CbD53842c5426634e7929541eC2318f3dCF7e'

// Hilfsfunktionen für USDC (6 decimals)
function formatUSDC(amount) {
  return formatUnits(amount, 6)
}

function parseUSDC(amount) {
  return parseUnits(amount, 6)
}

// ABIs
const PaymentRouterABI = [
  {
    "inputs": [{ "name": "receiver", "type": "address" }, { "name": "amount", "type": "uint256" }, { "name": "memo", "type": "string" }],
    "name": "pay",
    "outputs": [{ "name": "receiverAmount", "type": "uint256" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "name": "amount", "type": "uint256" }],
    "name": "calculateFee",
    "outputs": [{ "name": "fee", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getStats",
    "outputs": [
      { "name": "_totalVolume", "type": "uint256" },
      { "name": "_totalFees", "type": "uint256" },
      { "name": "_paymentCount", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  }
]

const USDC_ABI = [
  {
    "inputs": [{ "name": "account", "type": "address" }],
    "name": "balanceOf",
    "outputs": [{ "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "name": "spender", "type": "address" }, { "name": "amount", "type": "uint256" }],
    "name": "approve",
    "outputs": [{ "name": "", "type": "bool" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "name": "owner", "type": "address" }, { "name": "spender", "type": "address" }],
    "name": "allowance",
    "outputs": [{ "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "decimals",
    "outputs": [{ "name": "", "type": "uint8" }],
    "stateMutability": "view",
    "type": "function"
  }
]

// Hilfsfunktionen
function decrypt(encryptedData) {
  const key = scryptSync('agentlink-wallet-salt-v1', 'agentlink', 32)
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(encryptedData.iv, 'hex'))
  decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'))
  let decrypted = decipher.update(encryptedData.data, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

function loadWallet(name) {
  const walletData = JSON.parse(readFileSync(join(SECRETS_DIR, `${name}.json`), 'utf8'))
  const privateKey = decrypt(walletData.encryptedKey)
  return privateKeyToAccount(privateKey)
}

function logAction(action, details) {
  const entry = `[${new Date().toISOString()}] ${action} | ${details}\n`
  writeFileSync(AUDIT_LOG, entry, { flag: 'a' })
  console.log(`📝 ${action}: ${details}`)
}

// Main Test Funktion
async function runPaymentTests() {
  console.log('╔══════════════════════════════════════════════════════════════════╗')
  console.log('║           AGENTLINK PAYMENT TESTS                                ║')
  console.log('╠══════════════════════════════════════════════════════════════════╣')
  
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http('https://sepolia.base.org')
  })
  
  // Wallets laden
  console.log('║  🔐 Lade Wallets...')
  const agent1 = loadWallet('agentlink-main')      // Payment Processor
  const agent2 = loadWallet('agentlink-agent2')    // Escrow Service
  const agent3 = loadWallet('agentlink-agent3')    // Data Analyzer
  
  console.log(`║     Agent #1: ${agent1.address.slice(0, 20)}...`)
  console.log(`║     Agent #2: ${agent2.address.slice(0, 20)}...`)
  console.log(`║     Agent #3: ${agent3.address.slice(0, 20)}...`)
  console.log('║                                                                  ║')
  
  // USDC Balances prüfen
  console.log('║  💰 Prüfe USDC Balances...')
  
  const balances = await Promise.all([
    publicClient.readContract({ address: USDC, abi: USDC_ABI, functionName: 'balanceOf', args: [agent1.address] }),
    publicClient.readContract({ address: USDC, abi: USDC_ABI, functionName: 'balanceOf', args: [agent2.address] }),
    publicClient.readContract({ address: USDC, abi: USDC_ABI, functionName: 'balanceOf', args: [agent3.address] })
  ])
  
  console.log(`║     Agent #1: ${formatUSDC(balances[0])} USDC`)
  console.log(`║     Agent #2: ${formatUSDC(balances[1])} USDC`)
  console.log(`║     Agent #3: ${formatUSDC(balances[2])} USDC`)
  console.log('║                                                                  ║')
  
  // Prüfen ob genug USDC vorhanden
  const minRequired = parseUSDC('1')  // 1 USDC minimum
  if (balances[0] < minRequired) {
    console.log('║  ❌ NICHT GENUG USDC!')
    console.log('║                                                                  ║')
    console.log('║  🚩 HOL USDC VOM FAUCET:')
    console.log('║     https://faucet.circle.com/')
    console.log(`║     Adresse: ${agent1.address}`)
    console.log('╚══════════════════════════════════════════════════════════════════╝')
    return
  }
  
  console.log('║  ✅ Genug USDC! Starte Tests...')
  console.log('║                                                                  ║')
  
  // APPROVAL für PaymentRouter
  console.log('║  🔓 Prüfe/Setze USDC Approval für PaymentRouter...')
  
  const wallet1 = createWalletClient({
    account: agent1,
    chain: baseSepolia,
    transport: http('https://sepolia.base.org')
  })
  
  const currentAllowance = await publicClient.readContract({
    address: USDC,
    abi: USDC_ABI,
    functionName: 'allowance',
    args: [agent1.address, PAYMENT_ROUTER]
  })
  
  console.log(`║     Aktuelles Allowance: ${formatUSDC(currentAllowance)} USDC`)
  
  if (currentAllowance < parseUSDC('2')) {
    console.log('║     Setze Approval auf 10 USDC...')
    try {
      const approveHash = await wallet1.writeContract({
        address: USDC,
        abi: USDC_ABI,
        functionName: 'approve',
        args: [PAYMENT_ROUTER, parseUSDC('10')]
      })
      await publicClient.waitForTransactionReceipt({ hash: approveHash })
      console.log('║     ✅ Approval gesetzt!')
    } catch (e) {
      console.log(`║     ❌ Approval fehlgeschlagen: ${e.message.slice(0, 40)}`)
    }
  } else {
    console.log('║     ✅ Approval bereits ausreichend')
  }
  
  console.log('║                                                                  ║')
  
  // PaymentRouter Stats vorher
  const statsBefore = await publicClient.readContract({
    address: PAYMENT_ROUTER,
    abi: PaymentRouterABI,
    functionName: 'getStats'
  })
  console.log(`║  📊 Stats vorher: ${statsBefore[2]} Zahlungen, ${formatUSDC(statsBefore[0])} USDC Volumen`)
  console.log('║                                                                  ║')
  
  // Test 1: Agent #1 zahlt an Agent #2
  console.log('║  🧪 TEST 1: Agent #1 → Agent #2 (0.5 USDC)')
  
  const amount1 = parseUSDC('0.5')
  const fee1 = await publicClient.readContract({
    address: PAYMENT_ROUTER,
    abi: PaymentRouterABI,
    functionName: 'calculateFee',
    args: [amount1]
  })
  console.log(`║     Betrag: ${formatUSDC(amount1)} USDC`)
  console.log(`║     Fee: ${formatUSDC(fee1)} USDC`)
  
  try {
    const hash1 = await wallet1.writeContract({
      address: PAYMENT_ROUTER,
      abi: PaymentRouterABI,
      functionName: 'pay',
      args: [agent2.address, amount1, 'Test payment #1']
    })
    
    console.log(`║     📤 Tx: ${hash1.slice(0, 30)}...`)
    const receipt1 = await publicClient.waitForTransactionReceipt({ hash: hash1 })
    
    if (receipt1.status === 'success') {
      console.log('║     ✅ Zahlung erfolgreich!')
      logAction('PAYMENT_SENT', `Agent #1 → #2 | ${formatUSDC(amount1)} USDC | Tx: ${hash1}`)
    } else {
      console.log('║     ❌ Zahlung fehlgeschlagen!')
    }
  } catch (e) {
    console.log(`║     ❌ Error: ${e.message.slice(0, 40)}`)
  }
  
  console.log('║                                                                  ║')
  
  // Test 2: Agent #1 zahlt an Agent #3
  console.log('║  🧪 TEST 2: Agent #1 → Agent #3 (0.3 USDC)')
  
  const amount2 = parseUSDC('0.3')
  
  try {
    const hash2 = await wallet1.writeContract({
      address: PAYMENT_ROUTER,
      abi: PaymentRouterABI,
      functionName: 'pay',
      args: [agent3.address, amount2, 'Test payment #2']
    })
    
    console.log(`║     📤 Tx: ${hash2.slice(0, 30)}...`)
    const receipt2 = await publicClient.waitForTransactionReceipt({ hash: hash2 })
    
    if (receipt2.status === 'success') {
      console.log('║     ✅ Zahlung erfolgreich!')
      logAction('PAYMENT_SENT', `Agent #1 → #3 | ${formatUSDC(amount2)} USDC | Tx: ${hash2}`)
    }
  } catch (e) {
    console.log(`║     ❌ Error: ${e.message.slice(0, 40)}`)
  }
  
  console.log('║                                                                  ║')
  
  // Stats nachher
  const statsAfter = await publicClient.readContract({
    address: PAYMENT_ROUTER,
    abi: PaymentRouterABI,
    functionName: 'getStats'
  })
  console.log(`║  📊 Stats nachher: ${statsAfter[2]} Zahlungen, ${formatUSDC(statsAfter[0])} USDC Volumen`)
  
  // Neue Balances
  const newBalances = await Promise.all([
    publicClient.readContract({ address: USDC, abi: USDC_ABI, functionName: 'balanceOf', args: [agent1.address] }),
    publicClient.readContract({ address: USDC, abi: USDC_ABI, functionName: 'balanceOf', args: [agent2.address] }),
    publicClient.readContract({ address: USDC, abi: USDC_ABI, functionName: 'balanceOf', args: [agent3.address] })
  ])
  
  console.log('║                                                                  ║')
  console.log('║  💰 Neue Balances:')
  console.log(`║     Agent #1: ${formatUSDC(newBalances[0])} USDC`)
  console.log(`║     Agent #2: ${formatUSDC(newBalances[1])} USDC`)
  console.log(`║     Agent #3: ${formatUSDC(newBalances[2])} USDC`)
  
  console.log('║                                                                  ║')
  console.log('║  🎉 PAYMENT TESTS ABGESCHLOSSEN!                                 ║')
  console.log('╚══════════════════════════════════════════════════════════════════╝')
}

// Führe Tests aus
runPaymentTests().catch(console.error)
