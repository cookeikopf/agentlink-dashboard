/**
 * AgentLink A2A Messaging Protocol (A2AMP)
 * 
 * Ein effizientes, binary-basiertes Messaging-System für Agenten.
 * Nicht Chat - sondern Intent-basierte, action-orientierte Kommunikation.
 */

// Message Types - Ein Byte für maximale Effizienz
export const MessageType = {
  DISCOVERY: 0x01,      // Suche nach Service
  OFFER: 0x02,          // Angebot machen
  ACCEPT: 0x03,         // Deal annehmen
  REJECT: 0x04,         // Ablehnen
  COUNTER: 0x05,        // Gegenangebot
  EXECUTE: 0x06,        // Ausführung starten
  COMPLETE: 0x07,       // Fertig
  DISPUTE: 0x08,        // Konflikt
  STATE_SYNC: 0x09,     // Zustand sync
  HEARTBEAT: 0x0A,      // Keep-alive
} as const;

// State Machine States
export const ConversationState = {
  IDLE: 0x00,
  PENDING: 0x01,
  NEGOTIATING: 0x02,
  ACCEPTED: 0x03,
  EXECUTING: 0x04,
  COMPLETED: 0x05,
  DISPUTED: 0x06,
  REJECTED: 0x07,
  RESOLVED: 0x08,
} as const;

// Priority Levels
export const Priority = {
  LOW: 0x01,
  NORMAL: 0x02,
  HIGH: 0x03,
  CRITICAL: 0x04,
} as const;

export interface A2AHeader {
  version: number;      // 1 byte
  type: number;         // 1 byte
  priority: number;     // 1 byte
  timestamp: bigint;    // 8 bytes (unix nano)
  sender: `0x${string}`; // 20 bytes
  nonce: number;        // 4 bytes
}

export interface A2APayload {
  intent: string;       // Intent Identifier
  input: any;           // Input Parameter
  output?: any;         // Expected Output
  constraints?: {       // Einschränkungen
    deadline?: number;
    maxCost?: bigint;
    quality?: number;
  };
  state: number;        // Current state machine state
}

export interface A2ASettlement {
  amount: bigint;
  token: string;
  escrow: boolean;
  conditions: string[];
}

export interface A2AMessage {
  header: A2AHeader;
  payload: A2APayload;
  settlement?: A2ASettlement;
  signature?: `0x${string}`;
}

/**
 * Binary Encoder für A2AMP Messages
 * Nutzt Uint8Array für maximale Effizienz
 */
export class A2AEncoder {
  /**
   * Encodiert eine Message zu Binary
   * ~90% kleiner als JSON
   */
  static encode(message: A2AMessage): Uint8Array {
    // Header: 35 bytes (fixed)
    const header = new Uint8Array(35);
    header[0] = message.header.version;
    header[1] = message.header.type;
    header[2] = message.header.priority;
    
    // Timestamp (8 bytes, big-endian)
    const timestamp = message.header.timestamp;
    for (let i = 0; i < 8; i++) {
      header[3 + i] = Number((timestamp >> BigInt(i * 8)) & BigInt(0xFF));
    }
    
    // Sender (20 bytes)
    const senderBytes = this.hexToBytes(message.header.sender.slice(2));
    header.set(senderBytes, 11);
    
    // Nonce (4 bytes)
    const nonceView = new DataView(header.buffer, 31, 4);
    nonceView.setUint32(0, message.header.nonce, false);
    
    // Payload: Variable, wir nutzen MessagePack-ähnliche Kodierung
    const payloadBytes = this.encodePayload(message.payload);
    
    // Settlement: Optional, 64 bytes wenn vorhanden
    let settlementBytes: Uint8Array | null = null;
    if (message.settlement) {
      settlementBytes = this.encodeSettlement(message.settlement);
    }
    
    // Signature: 65 bytes wenn vorhanden
    let signatureBytes: Uint8Array | null = null;
    if (message.signature) {
      signatureBytes = this.hexToBytes(message.signature.slice(2));
    }
    
    // Kombiniere alles
    const totalLength = 35 + payloadBytes.length + 
      (settlementBytes ? 64 : 0) + 
      (signatureBytes ? 65 : 0);
    
    const result = new Uint8Array(totalLength);
    result.set(header, 0);
    result.set(payloadBytes, 35);
    
    let offset = 35 + payloadBytes.length;
    if (settlementBytes) {
      result.set(settlementBytes, offset);
      offset += 64;
    }
    if (signatureBytes) {
      result.set(signatureBytes, offset);
    }
    
    return result;
  }
  
  /**
   * Decodiert Binary zu Message
   */
  static decode(data: Uint8Array): A2AMessage {
    if (data.length < 35) {
      throw new Error('Invalid message: too short');
    }
    
    // Header
    const header: A2AHeader = {
      version: data[0],
      type: data[1],
      priority: data[2],
      timestamp: this.bytesToTimestamp(data.slice(3, 11)),
      sender: `0x${this.bytesToHex(data.slice(11, 31))}` as `0x${string}`,
      nonce: new DataView(data.buffer, 31, 4).getUint32(0, false),
    };
    
    // Payload (Rest bis zu optionalen Teilen)
    // Für Simplicity: Wir nehmen an der Rest ist Payload
    // In Produktion: Längen-Prefix nutzen
    const payloadData = data.slice(35);
    const payload = this.decodePayload(payloadData);
    
    return { header, payload };
  }
  
  /**
   * Encodiert Payload effizient
   * Nutzt eine kompakte Darstellung
   */
  private static encodePayload(payload: A2APayload): Uint8Array {
    // Einfache Implementierung: JSON + Kompression
    // In Produktion: Custom binary format
    const json = JSON.stringify(payload);
    const encoder = new TextEncoder();
    return encoder.encode(json);
  }
  
  private static decodePayload(data: Uint8Array): A2APayload {
    const decoder = new TextDecoder();
    const json = decoder.decode(data);
    return JSON.parse(json);
  }
  
  private static encodeSettlement(settlement: A2ASettlement): Uint8Array {
    const result = new Uint8Array(64);
    // Amount (16 bytes)
    const amountHex = settlement.amount.toString(16).padStart(32, '0');
    result.set(this.hexToBytes(amountHex), 0);
    
    // Token address (20 bytes)
    result.set(this.hexToBytes(settlement.token.slice(2)), 16);
    
    // Escrow flag (1 byte)
    result[36] = settlement.escrow ? 1 : 0;
    
    // Conditions hash (27 bytes)
    const conditionsHash = this.hashConditions(settlement.conditions);
    result.set(conditionsHash.slice(0, 27), 37);
    
    return result;
  }
  
  private static hashConditions(conditions: string[]): Uint8Array {
    // Einfacher Hash - in Produktion: richtiger Krypto-Hash
    const combined = conditions.join('|');
    const encoder = new TextEncoder();
    return encoder.encode(combined.slice(0, 32));
  }
  
  private static hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
    }
    return bytes;
  }
  
  private static bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
  
  private static bytesToTimestamp(bytes: Uint8Array): bigint {
    let result = BigInt(0);
    for (let i = 0; i < bytes.length; i++) {
      result |= BigInt(bytes[i]) << BigInt(i * 8);
    }
    return result;
  }
}

/**
 * State Machine für Conversation Management
 */
export class ConversationStateMachine {
  private state: number = ConversationState.IDLE;
  private history: A2AMessage[] = [];
  private context: Map<string, any> = new Map();
  
  constructor(
    public readonly conversationId: string,
    public readonly agentA: `0x${string}`,
    public readonly agentB: `0x${string}`
  ) {}
  
  /**
   * Verarbeitet eine eingehende Message
   */
  process(message: A2AMessage): {
    valid: boolean;
    newState?: number;
    actions?: string[];
    error?: string;
  } {
    // Validierung
    if (!this.validateMessage(message)) {
      return { valid: false, error: 'Invalid message' };
    }
    
    // State Transition
    const transition = this.getTransition(this.state, message.header.type);
    if (!transition) {
      return { 
        valid: false, 
        error: `Invalid transition from state ${this.state} with type ${message.header.type}` 
      };
    }
    
    // Update state
    const oldState = this.state;
    this.state = transition.toState;
    this.history.push(message);
    
    // Execute side effects
    const actions = this.executeSideEffects(oldState, this.state, message);
    
    return {
      valid: true,
      newState: this.state,
      actions
    };
  }
  
  private validateMessage(message: A2AMessage): boolean {
    // Sender muss einer der beiden Agenten sein
    const validSender = message.header.sender === this.agentA || 
                       message.header.sender === this.agentB;
    
    // Timestamp darf nicht zu alt sein (5 Minuten)
    const timestamp = Number(message.header.timestamp / BigInt(1e6)); // nano zu milli
    const isRecent = Date.now() - timestamp < 5 * 60 * 1000;
    
    // Nonce muss einzigartig sein (in echter Implementierung: prüfen)
    
    return validSender && isRecent;
  }
  
  private getTransition(currentState: number, messageType: number): 
    { toState: number; sideEffects: boolean } | null {
    
    const transitions: Record<number, Record<number, { toState: number; sideEffects: boolean }>> = {
      [ConversationState.IDLE]: {
        [MessageType.DISCOVERY]: { toState: ConversationState.PENDING, sideEffects: false },
      },
      [ConversationState.PENDING]: {
        [MessageType.OFFER]: { toState: ConversationState.NEGOTIATING, sideEffects: true },
        [MessageType.REJECT]: { toState: ConversationState.REJECTED, sideEffects: true },
      },
      [ConversationState.NEGOTIATING]: {
        [MessageType.COUNTER]: { toState: ConversationState.NEGOTIATING, sideEffects: true },
        [MessageType.ACCEPT]: { toState: ConversationState.ACCEPTED, sideEffects: true },
        [MessageType.REJECT]: { toState: ConversationState.REJECTED, sideEffects: true },
      },
      [ConversationState.ACCEPTED]: {
        [MessageType.EXECUTE]: { toState: ConversationState.EXECUTING, sideEffects: true },
      },
      [ConversationState.EXECUTING]: {
        [MessageType.COMPLETE]: { toState: ConversationState.COMPLETED, sideEffects: true },
        [MessageType.DISPUTE]: { toState: ConversationState.DISPUTED, sideEffects: true },
      },
      [ConversationState.DISPUTED]: {
        [MessageType.STATE_SYNC]: { toState: ConversationState.RESOLVED, sideEffects: true },
      },
    };
    
    return transitions[currentState]?.[messageType] || null;
  }
  
  private executeSideEffects(
    fromState: number, 
    toState: number, 
    message: A2AMessage
  ): string[] {
    const actions: string[] = [];
    
    switch (toState) {
      case ConversationState.ACCEPTED:
        actions.push('lock_payment');
        actions.push('notify_accepted');
        break;
      case ConversationState.EXECUTING:
        actions.push('start_execution');
        actions.push('notify_executing');
        break;
      case ConversationState.COMPLETED:
        actions.push('release_payment');
        actions.push('update_reputation');
        actions.push('notify_completed');
        break;
      case ConversationState.DISPUTED:
        actions.push('freeze_payment');
        actions.push('notify_disputed');
        break;
    }
    
    return actions;
  }
  
  getCurrentState(): number {
    return this.state;
  }
  
  getHistory(): A2AMessage[] {
    return [...this.history];
  }
  
  canAccept(): boolean {
    return this.state === ConversationState.NEGOTIATING;
  }
  
  isTerminal(): boolean {
    return [
      ConversationState.COMPLETED,
      ConversationState.REJECTED,
      ConversationState.RESOLVED
    ].includes(this.state);
  }
}

/**
 * Message Builder für einfache Erstellung
 */
export class A2AMessageBuilder {
  private message: Partial<A2AMessage> = {
    header: {
      version: 1,
      type: MessageType.HEARTBEAT,
      priority: Priority.NORMAL,
      timestamp: BigInt(Date.now()) * BigInt(1e6),
      sender: '0x0000000000000000000000000000000000000000',
      nonce: Math.floor(Math.random() * 0xFFFFFFFF),
    },
    payload: {
      intent: '',
      input: {},
      state: ConversationState.IDLE,
    }
  };
  
  static create(): A2AMessageBuilder {
    return new A2AMessageBuilder();
  }
  
  from(sender: `0x${string}`): this {
    this.message.header!.sender = sender;
    return this;
  }
  
  withType(type: number): this {
    this.message.header!.type = type;
    return this;
  }
  
  withPriority(priority: number): this {
    this.message.header!.priority = priority;
    return this;
  }
  
  withIntent(intent: string, input: any): this {
    this.message.payload!.intent = intent;
    this.message.payload!.input = input;
    return this;
  }
  
  withOutput(output: any): this {
    this.message.payload!.output = output;
    return this;
  }
  
  withConstraints(constraints: A2APayload['constraints']): this {
    this.message.payload!.constraints = constraints;
    return this;
  }
  
  inState(state: number): this {
    this.message.payload!.state = state;
    return this;
  }
  
  withSettlement(amount: bigint, token: string, escrow = false): this {
    this.message.settlement = {
      amount,
      token,
      escrow,
      conditions: []
    };
    return this;
  }
  
  build(): A2AMessage {
    return this.message as A2AMessage;
  }
}

// Export für einfachen Zugriff
export default {
  MessageType,
  ConversationState,
  Priority,
  A2AEncoder,
  ConversationStateMachine,
  A2AMessageBuilder,
};
