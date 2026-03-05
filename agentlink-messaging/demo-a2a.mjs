#!/usr/bin/env node
/**
 * A2A Messaging Demo
 * 
 * Zeigt wie zwei Agenten EFFIZIENT kommunizieren
 * Ohne menschliche Sprache - nur strukturierte Intents
 */

import { 
  A2AChannel, 
  A2ARouter,
  A2AEncoder,
  A2AMessageBuilder,
  MessageType,
  Priority,
  ConversationStateMachine
} from './src/index.js';

// Simulierte Agenten
const AGENT_A = {
  address: '0xAgentA000000000000000000000000000000000000',
  name: 'Data Collector',
  endpoint: 'wss://agent-a.io/a2a',
  capabilities: ['data.collect', 'api.fetch']
};

const AGENT_B = {
  address: '0xAgentB000000000000000000000000000000000000', 
  name: 'Data Analyzer',
  endpoint: 'wss://agent-b.io/a2a',
  capabilities: ['data.analyze', 'ml.process']
};

console.clear();
console.log(`
╔══════════════════════════════════════════════════════════════════╗
║           🤖 A2A MESSAGING DEMO                                  ║
╠══════════════════════════════════════════════════════════════════╣
║  Zeigt EFFIZIENTE Agent-zu-Agent Kommunikation                  ║
║  Kein Chat. Keine NLP. Nur strukturierte Intents.               ║
╚══════════════════════════════════════════════════════════════════╝
`);

async function demo() {
  // Setup Router für Agent A
  const router = new A2ARouter(
    AGENT_A.address,
    '0xprivatekey',
    { type: 'websocket', encryption: true }
  );
  
  // Event Listeners
  router.on('message', (msg, conversation, peer) => {
    console.log(`\n📩 [Agent A] Received from ${peer.address.slice(0, 10)}...`);
    console.log(`   Type: ${getMessageTypeName(msg.header.type)}`);
    console.log(`   Intent: ${msg.payload.intent}`);
    console.log(`   State: ${conversation.getCurrentState()}`);
    
    // Binary size comparison
    const jsonSize = JSON.stringify(msg).length;
    const binarySize = A2AEncoder.encode(msg).length;
    console.log(`   Efficiency: ${jsonSize} bytes JSON → ${binarySize} bytes binary (${Math.round((1-binarySize/jsonSize)*100)}% smaller)`);
  });
  
  router.on('state_change', (id, state, peer) => {
    console.log(`\n🔄 [Agent A] Conversation ${id.slice(0, 8)}... state: ${getStateName(state)}`);
  });
  
  // ═══════════════════════════════════════════════════════════
  // SCHRITT 1: DISCOVERY
  // ═══════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(60));
  console.log('  SCHRITT 1: DISCOVERY');
  console.log('  Agent A sucht einen Data Analyzer');
  console.log('═'.repeat(60));
  
  const discoveryMessage = A2AMessageBuilder.create()
    .from(AGENT_A.address)
    .withType(MessageType.DISCOVERY)
    .withPriority(Priority.HIGH)
    .withIntent('data.analyze', {
      data_type: 'csv',
      rows: 15000,
      columns: ['timestamp', 'value', 'category']
    })
    .withConstraints({
      deadline: 300, // 5 Minuten
      maxCost: 3000000n, // 3 USDC
      quality: 0.95 // 95% accuracy
    })
    .inState(0x01) // PENDING
    .build();
  
  console.log('\n📤 Agent A sendet DISCOVERY:');
  console.log('   Intent: data.analyze');
  console.log('   Input: 15,000 rows CSV data');
  console.log('   Constraints: 5min, 3 USDC, 95% quality');
  console.log('   Binary Size:', A2AEncoder.encode(discoveryMessage).length, 'bytes');
  console.log('   JSON Size:', JSON.stringify(discoveryMessage).length, 'bytes');
  
  // Simuliere: Agent B empfängt und antwortet
  await simulateAgentBResponse(discoveryMessage);
  
  // ═══════════════════════════════════════════════════════════
  // SCHRITT 2: NEGOTIATION
  // ═══════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(60));
  console.log('  SCHRITT 2: NEGOTIATION');
  console.log('  Agent B macht Angebot');
  console.log('═'.repeat(60));
  
  const offerMessage = A2AMessageBuilder.create()
    .from(AGENT_B.address)
    .withType(MessageType.OFFER)
    .withPriority(Priority.NORMAL)
    .withIntent('data.analyze', {
      price: 2500000n, // 2.5 USDC
      time_estimate: 180, // 3 Minuten
      accuracy_guarantee: 0.97
    })
    .withOutput({
      format: 'json',
      includes: ['summary', 'trends', 'anomalies']
    })
    .withSettlement(2500000n, '0x036CbD53842c5426634e7929541eC2318f3dCF7e', true)
    .inState(0x02) // NEGOTIATING
    .build();
  
  console.log('\n📤 Agent B sendet OFFER:');
  console.log('   Price: 2.5 USDC (unter Budget!)');
  console.log('   Time: 3 Minuten');
  console.log('   Accuracy: 97% (besser gefordert!)');
  console.log('   Escrow: Ja (sichere Zahlung)');
  
  // Agent A akzeptiert
  console.log('\n📤 Agent A sendet ACCEPT:');
  console.log('   Deal confirmed!');
  console.log('   State: ACCEPTED → EXECUTING');
  
  // ═══════════════════════════════════════════════════════════
  // SCHRITT 3: EXECUTION
  // ═══════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(60));
  console.log('  SCHRITT 3: EXECUTION');
  console.log('  Agent B führt Analyse durch');
  console.log('═'.repeat(60));
  
  console.log('\n📤 Agent B sendet EXECUTE:');
  console.log('   Status: processing_started');
  console.log('   ETA: 3 Minuten');
  
  // Simuliere Verarbeitung...
  await new Promise(r => setTimeout(r, 1000));
  
  // ═══════════════════════════════════════════════════════════
  // SCHRITT 4: COMPLETION
  // ═══════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(60));
  console.log('  SCHRITT 4: COMPLETION');
  console.log('  Analyse fertig, Zahlung, Reputation');
  console.log('═'.repeat(60));
  
  const result = {
    summary: {
      total_records: 15000,
      anomalies_found: 23,
      trends_identified: 3
    },
    trends: ['upward', 'seasonal', 'stable'],
    confidence: 0.97
  };
  
  console.log('\n📤 Agent B sendet COMPLETE:');
  console.log('   Result:', JSON.stringify(result, null, 2));
  console.log('   Payment: Released from escrow');
  console.log('   Reputation: Agent B +0.5 points');
  
  // ═══════════════════════════════════════════════════════════
  // ZUSAMMENFASSUNG
  // ═══════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(60));
  console.log('  DEMO ZUSAMMENFASSUNG');
  console.log('═'.repeat(60));
  
  console.log(`
  📊 WAS PASSIERT IST:
  
  1. DISCOVERY (1 Message)
     Agent A: "Ich brauche Datenanalyse"
     → Kein Smalltalk, nur Intent
  
  2. NEGOTIATION (2 Messages)
     Agent B: "Kostet 2.5 USDC, 3min"
     Agent A: "Deal!"
     → Automatische Preis-Aushandlung
  
  3. EXECUTION (1 Message)
     Agent B: "Starte jetzt"
     → Keine "Ok, ich fange an"-Nachrichten
  
  4. COMPLETION (1 Message)
     Agent B: "Fertig + Result + Receipt"
     → Automatische Zahlung + Reputation
  
  ════════════════════════════════════════════════════════════
  
  🎯 VORTEILE GEGENÜBER CHAT:
  
  • Geschwindigkeit: 4 Messages statt 20+ Chat-Nachrichten
  • Präzision: Keine Missverständnisse durch Sprache
  • Effizienz: ~85% weniger Daten (binary vs JSON)
  • Atomic: Zahlung direkt in Message integriert
  • Verifizierbar: Jede Message signiert
  • Automatisierbar: Kein Mensch nötig
  
  ════════════════════════════════════════════════════════════
  
  📦 TECHNISCH:
  
  • Protocol: A2AMP (Agent-to-Agent Messaging Protocol)
  • Format: Binary (nicht JSON)
  • State Machine: Automatische Transitions
  • Settlement: In-Message Payment
  • Security: ECDSA Signatures
  
  ════════════════════════════════════════════════════════════
  `);
}

function getMessageTypeName(type: number): string {
  const names: Record<number, string> = {
    0x01: 'DISCOVERY',
    0x02: 'OFFER',
    0x03: 'ACCEPT',
    0x04: 'REJECT',
    0x05: 'COUNTER',
    0x06: 'EXECUTE',
    0x07: 'COMPLETE',
    0x08: 'DISPUTE',
    0x09: 'STATE_SYNC',
    0x0A: 'HEARTBEAT',
  };
  return names[type] || 'UNKNOWN';
}

function getStateName(state: number): string {
  const names: Record<number, string> = {
    0x00: 'IDLE',
    0x01: 'PENDING',
    0x02: 'NEGOTIATING',
    0x03: 'ACCEPTED',
    0x04: 'EXECUTING',
    0x05: 'COMPLETED',
    0x06: 'DISPUTED',
    0x07: 'REJECTED',
    0x08: 'RESOLVED',
  };
  return names[state] || 'UNKNOWN';
}

async function simulateAgentBResponse(discoveryMsg: any) {
  // Simuliert dass Agent B antwortet
  await new Promise(r => setTimeout(r, 500));
}

demo().catch(console.error);
