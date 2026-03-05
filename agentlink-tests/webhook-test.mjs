import { createPublicClient, http } from 'viem'
import { baseSepolia } from 'viem/chains'

/**
 * AgentLink Webhook Test Script
 * 
 * Testet das Webhook-System für Echtzeit-Benachrichtigungen.
 */

const API_BASE = process.env.AGENTLINK_API_URL || 'http://localhost:3000'

console.log('╔══════════════════════════════════════════════════════════════════╗')
console.log('║           AGENTLINK WEBHOOK TESTS                                ║')
console.log('╠══════════════════════════════════════════════════════════════════╣')

// Test 1: Webhook registrieren
async function testWebhookRegistration() {
  console.log('║  🧪 TEST 1: Webhook registrieren                                 ║')
  
  const webhookData = {
    agentId: '1',
    url: 'https://webhook.site/test-agentlink',
    events: ['payment.received', 'payment.sent'],
    secret: 'test-secret-123'
  }
  
  try {
    const response = await fetch(`${API_BASE}/api/webhooks/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(webhookData)
    })
    
    const result = await response.json()
    
    if (response.ok) {
      console.log('║     ✅ Webhook registriert!')
      console.log(`║     ID: ${result.webhookId}`)
      console.log(`║     Secret: ${result.secret}`)
    } else {
      console.log(`║     ❌ Fehler: ${result.error || 'Unknown'}`)
    }
  } catch (e) {
    console.log(`║     ❌ Fehler: ${e.message}`)
    console.log('║     💡 Ist der Server laufen? (npm run dev)')
  }
  
  console.log('║                                                                  ║')
}

// Test 2: Webhooks auflisten
async function testListWebhooks() {
  console.log('║  🧪 TEST 2: Webhooks auflisten                                   ║')
  
  try {
    const response = await fetch(`${API_BASE}/api/webhooks?agentId=1`)
    const result = await response.json()
    
    if (response.ok) {
      console.log(`║     ✅ ${result.webhooks?.length || 0} Webhooks gefunden`)
      result.webhooks?.forEach((wh, i) => {
        console.log(`║       ${i + 1}. ${wh.url} (${wh.events.join(', ')})`)
      })
    } else {
      console.log(`║     ❌ Fehler: ${result.error || 'Unknown'}`)
    }
  } catch (e) {
    console.log(`║     ❌ Fehler: ${e.message}`)
  }
  
  console.log('║                                                                  ║')
}

// Test 3: Webhook Events simulieren
async function testWebhookEvents() {
  console.log('║  🧪 TEST 3: Webhook Events simulieren                            ║')
  console.log('║                                                                  ║')
  console.log('║     Events die gesendet werden:                                  ║')
  console.log('║     • payment.received - Wenn Agent Zahlung erhält              ║')
  console.log('║     • payment.sent - Wenn Agent Zahlung sendet                  ║')
  console.log('║     • agent.registered - Wenn neuer Agent erstellt wird         ║')
  console.log('║                                                                  ║')
  console.log('║     Headers:                                                     ║')
  console.log('║     • X-Webhook-Secret: Zum Verifizieren                        ║')
  console.log('║     • X-Webhook-Event: Event-Typ                                ║')
  console.log('║     • X-Webhook-Timestamp: Unix Zeitstempel                     ║')
  console.log('║                                                                  ║')
}

// Test 4: Payload Beispiele
async function showPayloadExamples() {
  console.log('║  🧪 TEST 4: Webhook Payload Beispiele                            ║')
  console.log('║                                                                  ║')
  
  const paymentReceived = {
    type: 'payment.received',
    timestamp: Date.now(),
    webhookId: 'wh_abc123',
    data: {
      from: '0x728b087E805AC1De7F89A03E65F6206073dba6D8',
      amount: '0.50',
      memo: 'Data processing fee',
      txHash: '0x...'
    }
  }
  
  console.log('║     payment.received:')
  console.log(JSON.stringify(paymentReceived, null, 2).split('\n').map(l => '║       ' + l).join('\n'))
  console.log('║                                                                  ║')
}

// Führe alle Tests aus
async function runAllTests() {
  await testWebhookRegistration()
  await testListWebhooks()
  await testWebhookEvents()
  await showPayloadExamples()
  
  console.log('║  🎉 WEBHOOK TESTS ABGESCHLOSSEN!                                 ║')
  console.log('╚══════════════════════════════════════════════════════════════════╝')
  console.log('')
  console.log('💡 Für echte Tests:')
  console.log('   1. Starte Server: cd /tmp/agentlink-clean && npm run dev')
  console.log('   2. Mache Zahlung: node payment-test.mjs')
  console.log('   3. Prüfe Webhook-Empfang auf webhook.site')
}

runAllTests().catch(console.error)
