/**
 * A2A Communication Layer
 * 
 * P2P Kommunikation zwischen Agenten
 * Unterstützt WebSocket, WebRTC und Libp2p
 */

import EventEmitter from 'events';
import { 
  A2AMessage, 
  A2AEncoder, 
  ConversationStateMachine,
  MessageType,
  A2AMessageBuilder
} from './protocol';

export interface PeerInfo {
  address: `0x${string}`;
  endpoint: string;
  capabilities: string[];
  reputation: number;
  lastSeen: number;
}

export interface ConnectionConfig {
  type: 'websocket' | 'webrtc' | 'libp2p';
  signaling?: string;
  encryption?: boolean;
  compression?: boolean;
}

/**
 * A2A Communication Channel
 * 
 * Verwaltet die Verbindung zwischen zwei Agenten
 */
export class A2AChannel extends EventEmitter {
  private peer: PeerInfo | null = null;
  private socket: WebSocket | null = null;
  private conversations: Map<string, ConversationStateMachine> = new Map();
  private pendingMessages: Map<number, { resolve: Function; reject: Function; timeout: NodeJS.Timeout }> = new Map();
  
  constructor(
    public readonly localAddress: `0x${string}`,
    private privateKey: string,
    private config: ConnectionConfig = { type: 'websocket' }
  ) {
    super();
  }
  
  /**
   * Verbindet zu einem Peer
   */
  async connect(peer: PeerInfo): Promise<void> {
    this.peer = peer;
    
    switch (this.config.type) {
      case 'websocket':
        await this.connectWebSocket(peer);
        break;
      case 'webrtc':
        await this.connectWebRTC(peer);
        break;
      default:
        throw new Error(`Unsupported connection type: ${this.config.type}`);
    }
  }
  
  private async connectWebSocket(peer: PeerInfo): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = peer.endpoint.replace('http', 'ws').replace('https', 'wss');
      this.socket = new WebSocket(`${wsUrl}/a2a`);
      
      this.socket.onopen = () => {
        console.log(`Connected to ${peer.address.slice(0, 20)}...`);
        this.emit('connected', peer);
        resolve();
      };
      
      this.socket.onmessage = (event) => {
        this.handleIncomingMessage(event.data);
      };
      
      this.socket.onerror = (error) => {
        this.emit('error', error);
        reject(error);
      };
      
      this.socket.onclose = () => {
        this.emit('disconnected');
      };
    });
  }
  
  private async connectWebRTC(peer: PeerInfo): Promise<void> {
    // WebRTC Implementierung würde hier kommen
    throw new Error('WebRTC not yet implemented');
  }
  
  /**
   * Sendet eine Message
   */
  async send(message: A2AMessage): Promise<void> {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected');
    }
    
    // Signiere Message
    const signedMessage = await this.signMessage(message);
    
    // Encodiere zu Binary
    const encoded = A2AEncoder.encode(signedMessage);
    
    // Sende
    this.socket.send(encoded);
    
    // Warte auf Ack (für wichtige Messages)
    if (message.header.priority >= 0x03) {
      await this.waitForAck(message.header.nonce);
    }
  }
  
  /**
   * Startet eine neue Conversation
   */
  async initiateConversation(
    intent: string,
    input: any,
    peerAddress: `0x${string}`
  ): Promise<string> {
    const conversationId = this.generateConversationId();
    
    // Erstelle State Machine
    const conversation = new ConversationStateMachine(
      conversationId,
      this.localAddress,
      peerAddress
    );
    this.conversations.set(conversationId, conversation);
    
    // Erstelle DISCOVERY Message
    const message = A2AMessageBuilder.create()
      .from(this.localAddress)
      .withType(MessageType.DISCOVERY)
      .withPriority(0x02)
      .withIntent(intent, input)
      .inState(0x01) // PENDING
      .build();
    
    await this.send(message);
    
    return conversationId;
  }
  
  /**
   * Antwortet auf ein Angebot
   */
  async respondToOffer(
    conversationId: string,
    accept: boolean,
    counterOffer?: { price: bigint; deadline: number }
  ): Promise<void> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }
    
    if (!conversation.canAccept()) {
      throw new Error('Cannot respond in current state');
    }
    
    let message: A2AMessage;
    
    if (accept) {
      message = A2AMessageBuilder.create()
        .from(this.localAddress)
        .withType(MessageType.ACCEPT)
        .inState(0x03) // ACCEPTED
        .build();
    } else if (counterOffer) {
      message = A2AMessageBuilder.create()
        .from(this.localAddress)
        .withType(MessageType.COUNTER)
        .withConstraints({ maxCost: counterOffer.price, deadline: counterOffer.deadline })
        .inState(0x02) // NEGOTIATING
        .build();
    } else {
      message = A2AMessageBuilder.create()
        .from(this.localAddress)
        .withType(MessageType.REJECT)
        .inState(0x07) // REJECTED
        .build();
    }
    
    await this.send(message);
  }
  
  /**
   * Schließt eine Conversation ab
   */
  async completeConversation(
    conversationId: string,
    result: any,
    receipt?: string
  ): Promise<void> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }
    
    const message = A2AMessageBuilder.create()
      .from(this.localAddress)
      .withType(MessageType.COMPLETE)
      .withOutput(result)
      .inState(0x05) // COMPLETED
      .build();
    
    await this.send(message);
  }
  
  private async handleIncomingMessage(data: ArrayBuffer | string): Promise<void> {
    try {
      let encoded: Uint8Array;
      
      if (typeof data === 'string') {
        // Fallback für Text-Frames
        encoded = new TextEncoder().encode(data);
      } else {
        encoded = new Uint8Array(data);
      }
      
      const message = A2AEncoder.decode(encoded);
      
      // Verifiziere Signatur
      const isValid = await this.verifyMessage(message);
      if (!isValid) {
        console.warn('Invalid message signature');
        return;
      }
      
      // Finde oder erstelle Conversation
      const conversationId = this.getConversationId(message);
      let conversation = this.conversations.get(conversationId);
      
      if (!conversation) {
        // Neue eingehende Conversation
        conversation = new ConversationStateMachine(
          conversationId,
          this.localAddress,
          message.header.sender
        );
        this.conversations.set(conversationId, conversation);
        this.emit('new_conversation', conversationId, message);
      }
      
      // Verarbeite Message durch State Machine
      const result = conversation.process(message);
      
      if (result.valid) {
        this.emit('message', message, conversation);
        this.emit(`state_change`, conversationId, result.newState);
        
        // Führe Side Effects aus
        if (result.actions) {
          for (const action of result.actions) {
            await this.executeAction(action, conversation, message);
          }
        }
      } else {
        this.emit('error', new Error(result.error), message);
      }
      
    } catch (error) {
      this.emit('error', error);
    }
  }
  
  private async executeAction(
    action: string,
    conversation: ConversationStateMachine,
    message: A2AMessage
  ): Promise<void> {
    switch (action) {
      case 'lock_payment':
        // Zahlung in Escrow sperren
        this.emit('payment_lock', conversation, message.settlement);
        break;
        
      case 'release_payment':
        // Zahlung freigeben
        this.emit('payment_release', conversation);
        break;
        
      case 'update_reputation':
        // Reputation aktualisieren
        this.emit('reputation_update', conversation);
        break;
        
      case 'start_execution':
        // Ausführung starten
        this.emit('execution_start', conversation, message.payload);
        break;
    }
  }
  
  private async signMessage(message: A2AMessage): Promise<A2AMessage> {
    // In echter Implementierung: ECDSA Signatur
    // Hier: Mock
    const messageCopy = { ...message };
    messageCopy.signature = '0x' + '00'.repeat(65) as `0x${string}`;
    return messageCopy;
  }
  
  private async verifyMessage(message: A2AMessage): Promise<boolean> {
    // In echter Implementierung: Signatur verifizieren
    return !!message.signature;
  }
  
  private async waitForAck(nonce: number, timeout = 5000): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingMessages.delete(nonce);
        reject(new Error('Message acknowledgement timeout'));
      }, timeout);
      
      this.pendingMessages.set(nonce, { resolve, reject, timeout: timer });
    });
  }
  
  private generateConversationId(): string {
    return `${this.localAddress.slice(2, 10)}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
  
  private getConversationId(message: A2AMessage): string {
    // Eindeutige ID aus Sender + Nonce
    return `${message.header.sender.slice(2, 10)}-${message.header.nonce}`;
  }
  
  disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.emit('disconnected');
  }
  
  isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }
  
  getConversation(id: string): ConversationStateMachine | undefined {
    return this.conversations.get(id);
  }
  
  getAllConversations(): Map<string, ConversationStateMachine> {
    return new Map(this.conversations);
  }
}

/**
 * A2A Router für Multi-Peer Management
 */
export class A2ARouter extends EventEmitter {
  private channels: Map<`0x${string}`, A2AChannel> = new Map();
  private localAddress: `0x${string}`;
  
  constructor(
    localAddress: `0x${string}`,
    private privateKey: string,
    private defaultConfig: ConnectionConfig
  ) {
    super();
    this.localAddress = localAddress;
  }
  
  /**
   * Verbindet zu einem Peer oder gibt existierenden Channel zurück
   */
  async connectTo(peer: PeerInfo): Promise<A2AChannel> {
    let channel = this.channels.get(peer.address);
    
    if (!channel || !channel.isConnected()) {
      channel = new A2AChannel(this.localAddress, this.privateKey, this.defaultConfig);
      
      channel.on('message', (msg, conv) => this.emit('message', msg, conv, peer));
      channel.on('state_change', (id, state) => this.emit('state_change', id, state, peer));
      channel.on('payment_lock', (conv, settlement) => this.emit('payment_lock', conv, settlement));
      channel.on('payment_release', (conv) => this.emit('payment_release', conv));
      
      await channel.connect(peer);
      this.channels.set(peer.address, channel);
    }
    
    return channel;
  }
  
  /**
   * Broadcast eine Message an alle verbundenen Peers
   */
  async broadcast(message: A2AMessage): Promise<void> {
    const promises: Promise<void>[] = [];
    
    for (const [address, channel] of this.channels) {
      if (channel.isConnected()) {
        promises.push(channel.send(message));
      }
    }
    
    await Promise.all(promises);
  }
  
  /**
   * Holt einen Channel für eine Adresse
   */
  getChannel(address: `0x${string}`): A2AChannel | undefined {
    return this.channels.get(address);
  }
  
  /**
   * Trennt alle Verbindungen
   */
  disconnectAll(): void {
    for (const channel of this.channels.values()) {
      channel.disconnect();
    }
    this.channels.clear();
  }
  
  getConnectedPeers(): `0x${string}`[] {
    return Array.from(this.channels.entries())
      .filter(([_, channel]) => channel.isConnected())
      .map(([address, _]) => address);
  }
}

export default { A2AChannel, A2ARouter };
