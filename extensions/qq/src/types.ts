/**
 * QQ Channel Types
 */

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * QQ group-specific configuration.
 */
export interface QQGroupConfig {
  enabled?: boolean;
  requireMention?: boolean;
  tools?: unknown;
  toolsBySender?: Record<string, unknown>;
  skills?: string[];
  allowFrom?: Array<string | number>;
  systemPrompt?: string;
}

/**
 * QQ account configuration (raw from config file).
 */
export interface QQAccountConfig {
  name?: string;
  enabled?: boolean;
  wsUrl?: string;
  httpUrl?: string;
  accessToken?: string;
  dmPolicy?: "pairing" | "allowlist" | "open" | "disabled";
  allowFrom?: Array<string | number>;
  dmHistoryLimit?: number;
  groupPolicy?: "open" | "disabled" | "allowlist";
  groupAllowFrom?: Array<string | number>;
  groups?: Record<string, QQGroupConfig | undefined>;
  historyLimit?: number;
  replyToMode?: "off" | "first" | "all";
  markdown?: { tables?: "off" | "bullets" | "code" };
  textChunkLimit?: number;
  mediaMaxMb?: number;
  timeoutSeconds?: number;
  retry?: {
    attempts?: number;
    minDelayMs?: number;
    maxDelayMs?: number;
    jitter?: number;
  };
  reconnectIntervalMs?: number;
  heartbeatIntervalMs?: number;
}

// ============================================================================
// Resolved Account Type
// ============================================================================

/**
 * Resolved QQ account with merged configuration.
 */
export interface ResolvedQQAccount {
  /** Account ID (e.g., "default", "work") */
  accountId: string;
  /** Display name for the account */
  name?: string;
  /** Whether the account is enabled */
  enabled: boolean;
  /** WebSocket URL for OneBot connection */
  wsUrl: string;
  /** HTTP URL for OneBot API (optional, for hybrid mode) */
  httpUrl?: string;
  /** Access token for authentication */
  accessToken?: string;
  /** The resolved configuration */
  config: QQAccountConfig;
}

// ============================================================================
// Send Result Types
// ============================================================================

export interface QQSendResult {
  ok: true;
  messageId: string;
  chatId: string;
}

export interface QQSendError {
  ok: false;
  error: string;
}

export type QQSendResponse = QQSendResult | QQSendError;

// ============================================================================
// Connection State Types
// ============================================================================

export interface QQConnectionState {
  connected: boolean;
  selfId?: number;
  nickname?: string;
  lastHeartbeat?: number;
  lastError?: string;
}

// ============================================================================
// Runtime Status Types
// ============================================================================

export interface QQAccountRuntimeStatus {
  accountId: string;
  running: boolean;
  lastStartAt: number | null;
  lastStopAt: number | null;
  lastError: string | null;
  lastInboundAt?: number | null;
  lastOutboundAt?: number | null;
  connection?: QQConnectionState;
}

// ============================================================================
// Account Snapshot (for status display)
// ============================================================================

export interface QQAccountSnapshot {
  accountId: string;
  name?: string;
  enabled: boolean;
  configured: boolean;
  running: boolean;
  lastStartAt: number | null;
  lastStopAt: number | null;
  lastError: string | null;
  connection?: QQConnectionState;
  probe?: QQProbeResult;
}

// ============================================================================
// Probe Result (connection test)
// ============================================================================

export interface QQProbeResult {
  ok: boolean;
  selfId?: number;
  nickname?: string;
  error?: string;
  latencyMs?: number;
}

// ============================================================================
// Chat Types
// ============================================================================

export type QQChatType = "private" | "group";

// ============================================================================
// Target Types
// ============================================================================

export interface QQPrivateTarget {
  type: "private";
  userId: number;
}

export interface QQGroupTarget {
  type: "group";
  groupId: number;
}

export type QQTarget = QQPrivateTarget | QQGroupTarget;

// ============================================================================
// Parsed Message Types (normalized from OneBot)
// ============================================================================

export interface QQParsedMessage {
  messageId: string;
  chatType: QQChatType;
  chatId: string;
  senderId: string;
  senderName: string;
  text: string;
  rawMessage: string;
  timestamp: number;
  groupId?: number;
  replyToId?: string;
  mediaUrls?: string[];
  mentions?: string[];
}
