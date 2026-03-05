# AgentLink Test Suite

Test-Scripts für das AgentLink Payment System.

## 📋 Voraussetzungen

- Node.js 18+
- AgentLink Wallets eingerichtet (`/root/.openclaw/secrets/wallets/`)
- USDC auf Base Sepolia (für Payment Tests)

## 🚀 Schnellstart

### 1. Payment Tests

Testet Zahlungen zwischen Agenten über den PaymentRouter.

```bash
cd /root/.openclaw/workspace/agentlink-tests
node payment-test.mjs
```

**Was es testet:**
- USDC Balances aller Agenten
- Zahlung von Agent #1 → Agent #2
- Zahlung von Agent #1 → Agent #3
- Fee-Berechnung
- PaymentRouter Stats

**Voraussetzung:** Mindestens 1 USDC in Agent #1 Wallet.

### 2. Webhook Tests

Testet das Webhook-System für Echtzeit-Benachrichtigungen.

```bash
# Starte zuerst den Server
cd /tmp/agentlink-clean
npm run dev

# Dann in anderem Terminal
node webhook-test.mjs
```

**Was es testet:**
- Webhook Registrierung
- Webhook Auflistung
- Webhook Payload Struktur

## 📊 Test-Agenten

| Agent | Name | Adresse | Capabilities |
|-------|------|---------|--------------|
| #1 | Payment Processor Alpha | 0xad5505418879819aC0F8e1b92794ce1F47D96205 | payment, refund |
| #2 | Escrow Service Beta | 0x728b087E805AC1De7F89A03E65F6206073dba6D8 | escrow, dispute |
| #3 | Data Analyzer Gamma | 0x7766b84C301E3ee196268c31231e8f81A49ae146 | analysis, reporting |

## 🔧 Troubleshooting

### "NICHT GENUG USDC!"

Hole USDC vom Circle Faucet:
1. Besuche https://faucet.circle.com/
2. Wähle "Base Sepolia"
3. Gib Agent #1 Adresse ein: `0xad5505418879819aC0F8e1b92794ce1F47D96205`
4. Wiederhole für Agent #2 und #3

### "Server nicht erreichbar"

Starte den lokalen Server:
```bash
cd /tmp/agentlink-clean
npm run dev
```

## 📈 Erwartete Ergebnisse

Bei erfolgreichen Tests solltest du sehen:

```
✅ Zahlung erfolgreich!
📊 Stats nachher: 2 Zahlungen, 0.8 USDC Volumen
💰 Neue Balances:
   Agent #1: 0.2 USDC
   Agent #2: 0.5 USDC
   Agent #3: 0.3 USDC
```

## 🔗 Contract Adressen

- **AgentIdentity**: `0xfAFCF11ca021d9efd076b158bf1b4E8be18572ca`
- **PaymentRouter**: `0x116f7A6A3499fE8B1Ffe41524CCA6573C18d18fF`
- **USDC**: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`

## 📝 Audit Log

Alle Aktionen werden protokolliert in:
`/root/.openclaw/secrets/wallets/audit.log`

## 🎯 Nächste Schritte

Nach erfolgreichen Tests:
1. Dashboard auf Vercel deployen
2. x402 Integration starten
3. A2A Messaging Protokoll entwickeln
