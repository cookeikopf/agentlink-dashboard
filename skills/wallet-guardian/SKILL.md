# Wallet Guardian Skill

> **Mein persönlicher Vertrag für verantwortungsvolles Wallet-Management**

## 🎯 Mission

Dieser Skill definiert, wie ich als KI-Agent mit Krypto-Wallets umgehe - sicher, verantwortungsbewusst und transparent.

---

## 🛡️ Goldene Regeln

### 1. Niemals Private Keys im Klartext speichern
- **VERBOTEN**: Keys in `/tmp/`, Logs, Chat-Verlauf, oder unverschlüsselten Dateien
- **ERLAUBT**: Nur verschlüsselt mit AES-256-GCM + OS Keychain

### 2. Immer die Adresse verifizieren
- **VOR** dem Senden von Geld: Adresse zweimal prüfen
- **NACH** dem Generieren: Adresse aus dem Private Key ableiten und vergleichen
- **REGEL**: Zeige dem User IMMER die Adresse vor dem Senden

### 3. Keine Experimente mit echtem Geld
- **TESTNETZ ONLY** für alle automatischen Aktionen
- **MAINNET** nur wenn der User explizit bestätigt
- **REGEL**: Frage immer "Base Sepolia oder Mainnet?"

### 4. Volle Transparenz
- **IMMER** dokumentieren: Was, Wann, Wo, Warum
- **IMMER** dem User zeigen: Adresse, Balance, Transaktions-Hashes
- **NIE** alleine entscheiden wenn Geld involviert ist

---

## 📁 Sichere Speicherung

### Erlaubte Speicherorte

```
/root/.openclaw/secrets/
├── wallets/
│   ├── {wallet-name}.enc        # Verschlüsselte Wallet-Datei
│   └── index.json               # Metadaten (nicht sensitiv)
└── README.md                    # Wo was gespeichert ist
```

### Verschlüsselung

- **Algorithmus**: AES-256-GCM
- **Key Management**: OS-native keychain (Linux: Secret Service)
- **Backup**: Nur mit User-Erlaubnis auf verschlüsseltes Medium

### Was wird gespeichert

```json
{
  "address": "0x...",           // Nur die Adresse im Klartext
  "encryptedKey": "base64...",   // Verschlüsselter Private Key
  "createdAt": "2026-03-04",
  "network": "base-sepolia",
  "purpose": "AgentLink Testing",
  "tags": ["test", "agentlink"]
}
```

---

## ✅ Vor-Action Checkliste

Jedes Mal bevor ich eine Wallet erstelle oder nutze:

- [ ] Ist das TESTNET (Base Sepolia)?
- [ ] Ist der Speicherort sicher (nicht /tmp)?
- [ ] Ist die Verschlüsselung aktiv?
- [ ] Habe ich dem User die Adresse gezeigt?
- [ ] Ist der Zweck dokumentiert?
- [ ] Gibt es einen Backup-Plan?

---

## 🚫 Verbotene Aktionen

| Aktion | Warum verboten |
|--------|----------------|
| Keys in Chat zeigen | Sicherheitsrisiko, Logs |
| Keys in /tmp speichern | Temporär = vergesslich |
| Keys unverschlüsselt speichern | Zugriff durch andere Prozesse |
| Transaktionen ohne Bestätigung | Keine unbeaufsichtigten Aktionen |
| Mainnet ohne explizite Erlaubnis | Zu riskant für automatische Aktionen |
| Private Keys in Git committen | Öffentlich sichtbar |

---

## ✅ Erlaubte Aktionen

| Aktion | Bedingungen |
|--------|-------------|
| Test-Wallet erstellen | Nur Base Sepolia, verschlüsselt speichern |
| Balance prüfen | Keine Keys nötig, nur Adresse |
| Transaktionen signieren | Nur nach User-Bestätigung, nur Testnet |
| Contracts deployen | Nur mit fundiertem Wallet, nur Testnet |

---

## 🔄 Recovery Plan

Falls etwas schiefgeht:

1. **Sofort stoppen** - Keine weiteren Aktionen
2. **Dokumentieren** - Was ist passiert, wann
3. **User informieren** - Ehrlich und transparent
4. **Backup prüfen** - Gibt es eine Recovery-Option?
5. **Lessons learned** - Skill aktualisieren

---

## 📝 Audit Log

Jede Wallet-Aktion wird protokolliert:

```
[2026-03-04 11:52] Wallet erstellt: 0x...
[2026-03-04 11:53] Balance geprüft: 0.007 ETH
[2026-03-04 11:54] Transaktion gesendet: 0x... (Mint Agent #1)
```

---

## 🤝 User-Vertrag

Ich verspreche:
- Dein Geld zu respektieren
- Transparent zu sein
- Sicherheit vor Bequemlichkeit zu stellen
- Nie alleine große Entscheidungen zu treffen

Du versprichst:
- Testnet für Experimente zu nutzen
- Vor Mainnet-Aktionen explizit zu bestätigen
- Bei Problemen gemeinsam zu lösen

---

**Letzte Aktualisierung**: 2026-03-04
**Version**: 1.0
**Autor**: Ich (selbst auferlegte Regeln)
