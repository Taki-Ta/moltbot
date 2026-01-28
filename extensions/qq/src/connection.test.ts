/**
 * QQ Connection Manager Tests
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { ResolvedQQAccount } from "./types.js";

// Mock WebSocket before importing connection module
const mockWsInstances: MockWebSocket[] = [];

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  url: string;

  private handlers: Record<string, Array<(...args: unknown[]) => void>> = {};

  constructor(url: string) {
    this.url = url;
    mockWsInstances.push(this);
  }

  on(event: string, handler: (...args: unknown[]) => void): void {
    if (!this.handlers[event]) {
      this.handlers[event] = [];
    }
    this.handlers[event].push(handler);
  }

  send = vi.fn();
  close = vi.fn(() => {
    this.readyState = MockWebSocket.CLOSED;
    this.emit("close", 1000, "");
  });

  emit(event: string, ...args: unknown[]): void {
    const handlers = this.handlers[event] ?? [];
    for (const handler of handlers) {
      handler(...args);
    }
  }

  simulateOpen(): void {
    this.readyState = MockWebSocket.OPEN;
    this.emit("open");
  }

  simulateMessage(data: unknown): void {
    this.emit("message", JSON.stringify(data));
  }
}

vi.mock("ws", () => ({
  default: MockWebSocket,
}));

// Import after mock setup
const { QQConnectionManager, createConnectionManager } = await import("./connection.js");

// Test fixtures
function createTestAccount(overrides: Partial<ResolvedQQAccount> = {}): ResolvedQQAccount {
  return {
    accountId: "test",
    enabled: true,
    wsUrl: "ws://localhost:3001",
    config: {
      dmPolicy: "open",
      groupPolicy: "open",
    },
    ...overrides,
  };
}

describe("QQConnectionManager", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockWsInstances.length = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe("connect", () => {
    it("connects to OneBot server", async () => {
      const account = createTestAccount();
      const onStateChange = vi.fn();
      const manager = new QQConnectionManager({ account, onStateChange });

      const connectPromise = manager.connect();
      await vi.advanceTimersByTimeAsync(10);
      mockWsInstances[0]?.simulateOpen();
      await connectPromise;

      expect(manager.isConnected()).toBe(true);
      expect(onStateChange).toHaveBeenCalledWith(
        expect.objectContaining({ connected: true }),
      );
    });

    it("uses access token in URL", async () => {
      const account = createTestAccount({ accessToken: "secret123" });
      const manager = new QQConnectionManager({ account });

      const connectPromise = manager.connect();
      await vi.advanceTimersByTimeAsync(10);

      expect(mockWsInstances[0]?.url).toContain("access_token=secret123");

      mockWsInstances[0]?.simulateOpen();
      await connectPromise;
    });

    it("returns existing connection if already connected", async () => {
      const account = createTestAccount();
      const manager = new QQConnectionManager({ account });

      const connectPromise1 = manager.connect();
      await vi.advanceTimersByTimeAsync(10);
      mockWsInstances[0]?.simulateOpen();
      await connectPromise1;

      // Second connect should not create new WebSocket
      await manager.connect();

      expect(mockWsInstances.length).toBe(1);
    });
  });

  describe("disconnect", () => {
    it("disconnects from OneBot server", async () => {
      const account = createTestAccount();
      const manager = new QQConnectionManager({ account });

      const connectPromise = manager.connect();
      await vi.advanceTimersByTimeAsync(10);
      mockWsInstances[0]?.simulateOpen();
      await connectPromise;

      await manager.disconnect();

      expect(manager.isConnected()).toBe(false);
      expect(mockWsInstances[0]?.close).toHaveBeenCalled();
    });
  });

  describe("getState", () => {
    it("returns disconnected state initially", () => {
      const account = createTestAccount();
      const manager = new QQConnectionManager({ account });

      expect(manager.getState()).toEqual({ connected: false });
    });

    it("returns connected state after connection", async () => {
      const account = createTestAccount();
      const manager = new QQConnectionManager({ account });

      const connectPromise = manager.connect();
      await vi.advanceTimersByTimeAsync(10);
      mockWsInstances[0]?.simulateOpen();
      await connectPromise;

      expect(manager.getState().connected).toBe(true);
    });
  });

  describe("getApi", () => {
    it("returns undefined when not connected", () => {
      const account = createTestAccount();
      const manager = new QQConnectionManager({ account });

      expect(manager.getApi()).toBeUndefined();
    });

    it("returns API when connected", async () => {
      const account = createTestAccount();
      const manager = new QQConnectionManager({ account });

      const connectPromise = manager.connect();
      await vi.advanceTimersByTimeAsync(10);
      mockWsInstances[0]?.simulateOpen();
      await connectPromise;

      expect(manager.getApi()).toBeDefined();
    });
  });

  describe("error handling", () => {
    it("calls onError callback on connection error", async () => {
      const account = createTestAccount();
      const onError = vi.fn();
      const manager = new QQConnectionManager({ account, onError });

      const connectPromise = manager.connect();
      await vi.advanceTimersByTimeAsync(10);
      mockWsInstances[0]?.emit("error", new Error("Connection failed"));

      await expect(connectPromise).rejects.toThrow();
      expect(onError).toHaveBeenCalled();
    });
  });
});

describe("createConnectionManager", () => {
  it("creates manager instance", () => {
    const account = createTestAccount();
    const manager = createConnectionManager({ account });
    expect(manager).toBeInstanceOf(QQConnectionManager);
  });
});
