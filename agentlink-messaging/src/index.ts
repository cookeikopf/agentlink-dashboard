/**
 * AgentLink A2A Messaging Protocol
 * 
 * Exportiert alle Komponenten für einfachen Zugriff
 */

export {
  MessageType,
  ConversationState,
  Priority,
  A2AEncoder,
  ConversationStateMachine,
  A2AMessageBuilder,
  type A2AMessage,
  type A2AHeader,
  type A2APayload,
  type A2ASettlement,
} from './protocol.js';

export {
  A2AChannel,
  A2ARouter,
  type PeerInfo,
  type ConnectionConfig,
} from './communication.js';

export const VERSION = '0.1.0';
export const PROTOCOL_NAME = 'A2AMP';
