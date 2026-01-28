/**
 * QQ Connection Manager
 *
 * Manages OneBot WebSocket connections and lifecycle.
 */

import { OneBotClient, type OneBotClientOptions, type OneBotClientEvents } from "./onebot/client.js";
import { OneBotApi } from "./onebot/api.js";
import { createMessageMonitor, type MessageHandler, type QQMessageMonitor } from "./monitor.js";
import type { QQConnectionState, ResolvedQQAccount } from "./types.js";

// ============================================================================
// Types
// ============================================================================

export interface ConnectionManagerOptions {
  /** Account configuration */
  account: ResolvedQQAccount;
  /** Message handler callback */
  onMessage?: MessageHandler;
  /** Connection state change callback */
  onStateChange?: (state: QQConnectionState) => void;
  /** Error callback */
  onError?: (error: Error) => void;
  /** Log callback */
  onLog?: (level: "debug" | "info" | "warn" | "error", message: string) => void;
}

export interface QQConnection {
  /** Account ID */
  accountId: string;
  /** Connection state */
  state: QQConnectionState;
  /** OneBot client instance */
  client: OneBotClient;
  /** OneBot API wrapper */
  api: OneBotApi;
  /** Message monitor */
  monitor?: QQMessageMonitor;
}

// ============================================================================
// Connection Manager
// ============================================================================

/**
 * Manages QQ bot connections for multiple accounts.
 */
export class QQConnectionManager {
  private connections = new Map<string, QQConnection>();
  private options: ConnectionManagerOptions;

  constructor(options: ConnectionManagerOptions) {
    this.options = options;
  }

  /**
   * Connect to the OneBot server.
   */
  async connect(): Promise<void> {
    const { account } = this.options;
    const accountId = account.accountId;

    // Check if already connected
    if (this.connections.has(accountId)) {
      const existing = this.connections.get(accountId)!;
      if (existing.client.isConnected()) {
        return;
      }
      // Clean up existing connection
      await this.disconnect();
    }

    this.log("info", `Connecting to OneBot server at ${account.wsUrl}`);

    const clientOptions: OneBotClientOptions = {
      wsUrl: account.wsUrl,
      accessToken: account.accessToken,
      reconnectIntervalMs: account.config.reconnectIntervalMs ?? 5000,
      autoReconnect: true,
    };

    const state: QQConnectionState = {
      connected: false,
    };

    const clientEvents: OneBotClientEvents = {
      onConnect: () => {
        this.log("info", `Connected to OneBot server for account ${accountId}`);
        state.connected = true;
        this.fetchLoginInfo(accountId).catch(() => {});
        this.options.onStateChange?.(state);
      },
      onDisconnect: (code, reason) => {
        this.log("warn", `Disconnected from OneBot: ${code} - ${reason}`);
        state.connected = false;
        this.options.onStateChange?.(state);
      },
      onError: (error) => {
        this.log("error", `OneBot error: ${error.message}`);
        state.lastError = error.message;
        this.options.onError?.(error);
      },
      onReconnect: (attempt) => {
        this.log("info", `Reconnecting to OneBot (attempt ${attempt})`);
      },
      onEvent: (event) => {
        // Handle heartbeat events
        if (event.post_type === "meta_event" && event.meta_event_type === "heartbeat") {
          state.lastHeartbeat = Date.now();
        }
      },
    };

    const client = new OneBotClient(clientOptions, clientEvents);
    const api = new OneBotApi(client);

    // Set up message monitor if handler provided
    let monitor: QQMessageMonitor | undefined;
    if (this.options.onMessage) {
      monitor = createMessageMonitor({
        onMessage: this.options.onMessage,
        onError: (err) => this.options.onError?.(err),
        enablePrivate: account.config.dmPolicy !== "disabled",
        enableGroup: account.config.groupPolicy !== "disabled",
      });

      // Add monitor's event handler to client
      const originalOnEvent = clientEvents.onEvent;
      clientEvents.onEvent = (event) => {
        originalOnEvent?.(event);
        monitor?.processEvent(event);
      };
    }

    const connection: QQConnection = {
      accountId,
      state,
      client,
      api,
      monitor,
    };

    this.connections.set(accountId, connection);

    // Connect
    await client.connect();
  }

  /**
   * Disconnect from the OneBot server.
   */
  async disconnect(): Promise<void> {
    const { account } = this.options;
    const connection = this.connections.get(account.accountId);

    if (connection) {
      this.log("info", `Disconnecting from OneBot for account ${account.accountId}`);
      connection.client.disconnect();
      this.connections.delete(account.accountId);
    }
  }

  /**
   * Get connection for the account.
   */
  getConnection(): QQConnection | undefined {
    return this.connections.get(this.options.account.accountId);
  }

  /**
   * Check if connected.
   */
  isConnected(): boolean {
    const connection = this.getConnection();
    return connection?.client.isConnected() ?? false;
  }

  /**
   * Get current connection state.
   */
  getState(): QQConnectionState {
    const connection = this.getConnection();
    return connection?.state ?? { connected: false };
  }

  /**
   * Get API wrapper.
   */
  getApi(): OneBotApi | undefined {
    return this.getConnection()?.api;
  }

  /**
   * Fetch and update login info.
   */
  private async fetchLoginInfo(accountId: string): Promise<void> {
    const connection = this.connections.get(accountId);
    if (!connection || !connection.client.isConnected()) return;

    try {
      const info = await connection.api.getLoginInfo();
      connection.state.selfId = info.user_id;
      connection.state.nickname = info.nickname;
      this.log("info", `Bot logged in as ${info.nickname} (${info.user_id})`);
      this.options.onStateChange?.(connection.state);
    } catch (err) {
      this.log("warn", `Failed to fetch login info: ${err}`);
    }
  }

  /**
   * Log helper.
   */
  private log(level: "debug" | "info" | "warn" | "error", message: string): void {
    this.options.onLog?.(level, `[QQ:${this.options.account.accountId}] ${message}`);
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a connection manager for a QQ account.
 */
export function createConnectionManager(options: ConnectionManagerOptions): QQConnectionManager {
  return new QQConnectionManager(options);
}
