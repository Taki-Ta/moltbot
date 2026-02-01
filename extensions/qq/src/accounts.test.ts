/**
 * QQ Account Resolution Tests
 */

import { describe, expect, it } from "vitest";
import type { MoltbotConfig } from "openclaw/plugin-sdk";

import {
  listQQAccountIds,
  resolveDefaultQQAccountId,
  resolveQQAccount,
  listEnabledQQAccounts,
  isQQAccountConfigured,
  getQQAccountDefaults,
  DEFAULT_ACCOUNT_ID,
} from "./accounts.js";
import { QQ_DEFAULT_WS_URL, QQ_DEFAULT_TEXT_CHUNK_LIMIT } from "./config-schema.js";

describe("listQQAccountIds", () => {
  it("returns DEFAULT_ACCOUNT_ID when no config exists", () => {
    const cfg: MoltbotConfig = {};
    const ids = listQQAccountIds(cfg);
    expect(ids).toEqual([DEFAULT_ACCOUNT_ID]);
  });

  it("returns DEFAULT_ACCOUNT_ID when channels.qq is empty", () => {
    const cfg: MoltbotConfig = { channels: { qq: {} } };
    const ids = listQQAccountIds(cfg);
    expect(ids).toEqual([DEFAULT_ACCOUNT_ID]);
  });

  it("includes implicit default when base-level wsUrl is set", () => {
    const cfg: MoltbotConfig = {
      channels: {
        qq: { wsUrl: "ws://localhost:3001" },
      },
    };
    const ids = listQQAccountIds(cfg);
    expect(ids).toContain(DEFAULT_ACCOUNT_ID);
  });

  it("lists explicit accounts from accounts object", () => {
    const cfg: MoltbotConfig = {
      channels: {
        qq: {
          accounts: {
            work: { wsUrl: "ws://work:3001" },
            personal: { wsUrl: "ws://personal:3001" },
          },
        },
      },
    };
    const ids = listQQAccountIds(cfg);
    expect(ids).toContain("work");
    expect(ids).toContain("personal");
    expect(ids).toHaveLength(2);
  });

  it("includes both base-level default and explicit accounts", () => {
    const cfg: MoltbotConfig = {
      channels: {
        qq: {
          wsUrl: "ws://default:3001",
          accounts: {
            work: { wsUrl: "ws://work:3001" },
          },
        },
      },
    };
    const ids = listQQAccountIds(cfg);
    expect(ids).toContain(DEFAULT_ACCOUNT_ID);
    expect(ids).toContain("work");
  });

  it("sorts account IDs alphabetically", () => {
    const cfg: MoltbotConfig = {
      channels: {
        qq: {
          accounts: {
            zebra: {},
            alpha: {},
            beta: {},
          },
        },
      },
    };
    const ids = listQQAccountIds(cfg);
    expect(ids).toEqual(["alpha", "beta", "zebra"]);
  });
});

describe("resolveDefaultQQAccountId", () => {
  it("returns DEFAULT_ACCOUNT_ID when it exists", () => {
    const cfg: MoltbotConfig = {
      channels: {
        qq: {
          wsUrl: "ws://localhost:3001",
          accounts: { work: {} },
        },
      },
    };
    const defaultId = resolveDefaultQQAccountId(cfg);
    expect(defaultId).toBe(DEFAULT_ACCOUNT_ID);
  });

  it("returns first account when default does not exist", () => {
    const cfg: MoltbotConfig = {
      channels: {
        qq: {
          accounts: {
            work: { wsUrl: "ws://work:3001" },
            personal: { wsUrl: "ws://personal:3001" },
          },
        },
      },
    };
    const defaultId = resolveDefaultQQAccountId(cfg);
    expect(defaultId).toBe("personal"); // alphabetically first
  });

  it("returns DEFAULT_ACCOUNT_ID when no accounts configured", () => {
    const cfg: MoltbotConfig = {};
    const defaultId = resolveDefaultQQAccountId(cfg);
    expect(defaultId).toBe(DEFAULT_ACCOUNT_ID);
  });
});

describe("resolveQQAccount", () => {
  it("returns undefined when no QQ config exists", () => {
    const cfg: MoltbotConfig = {};
    const account = resolveQQAccount({ cfg });
    expect(account).toBeUndefined();
  });

  it("resolves default account from base-level config", () => {
    const cfg: MoltbotConfig = {
      channels: {
        qq: {
          wsUrl: "ws://localhost:3001",
          accessToken: "secret123",
          name: "My QQ Bot",
        },
      },
    };
    const account = resolveQQAccount({ cfg });
    expect(account).toBeDefined();
    expect(account?.accountId).toBe(DEFAULT_ACCOUNT_ID);
    expect(account?.wsUrl).toBe("ws://localhost:3001");
    expect(account?.accessToken).toBe("secret123");
    expect(account?.name).toBe("My QQ Bot");
    expect(account?.enabled).toBe(true);
  });

  it("resolves named account from accounts object", () => {
    const cfg: MoltbotConfig = {
      channels: {
        qq: {
          accounts: {
            work: {
              wsUrl: "ws://work:3001",
              name: "Work Bot",
            },
          },
        },
      },
    };
    const account = resolveQQAccount({ cfg, accountId: "work" });
    expect(account).toBeDefined();
    expect(account?.accountId).toBe("work");
    expect(account?.wsUrl).toBe("ws://work:3001");
    expect(account?.name).toBe("Work Bot");
  });

  it("merges base-level config with account-specific config", () => {
    const cfg: MoltbotConfig = {
      channels: {
        qq: {
          accessToken: "base-token",
          textChunkLimit: 2000,
          accounts: {
            work: {
              wsUrl: "ws://work:3001",
              // accessToken not specified, should inherit from base
            },
          },
        },
      },
    };
    const account = resolveQQAccount({ cfg, accountId: "work" });
    expect(account?.wsUrl).toBe("ws://work:3001");
    expect(account?.accessToken).toBe("base-token"); // inherited
    expect(account?.config.textChunkLimit).toBe(2000); // inherited
  });

  it("account-specific config overrides base-level config", () => {
    const cfg: MoltbotConfig = {
      channels: {
        qq: {
          accessToken: "base-token",
          accounts: {
            work: {
              wsUrl: "ws://work:3001",
              accessToken: "work-token",
            },
          },
        },
      },
    };
    const account = resolveQQAccount({ cfg, accountId: "work" });
    expect(account?.accessToken).toBe("work-token"); // overridden
  });

  it("uses default wsUrl when not specified", () => {
    const cfg: MoltbotConfig = {
      channels: {
        qq: {
          enabled: true,
        },
      },
    };
    const account = resolveQQAccount({ cfg });
    expect(account?.wsUrl).toBe(QQ_DEFAULT_WS_URL);
  });

  it("returns undefined for non-existent account", () => {
    const cfg: MoltbotConfig = {
      channels: {
        qq: {
          accounts: {
            work: { wsUrl: "ws://work:3001" },
          },
        },
      },
    };
    const account = resolveQQAccount({ cfg, accountId: "nonexistent" });
    expect(account).toBeUndefined();
  });

  it("respects enabled flag at base level", () => {
    const cfg: MoltbotConfig = {
      channels: {
        qq: {
          enabled: false,
          wsUrl: "ws://localhost:3001",
        },
      },
    };
    const account = resolveQQAccount({ cfg });
    expect(account?.enabled).toBe(false);
  });

  it("respects enabled flag at account level", () => {
    const cfg: MoltbotConfig = {
      channels: {
        qq: {
          enabled: true,
          accounts: {
            work: {
              wsUrl: "ws://work:3001",
              enabled: false,
            },
          },
        },
      },
    };
    const account = resolveQQAccount({ cfg, accountId: "work" });
    expect(account?.enabled).toBe(false);
  });

  it("normalizes account ID", () => {
    const cfg: MoltbotConfig = {
      channels: {
        qq: {
          accounts: {
            "My-Account": { wsUrl: "ws://test:3001" },
          },
        },
      },
    };
    const account = resolveQQAccount({ cfg, accountId: "my-account" });
    expect(account).toBeDefined();
    expect(account?.wsUrl).toBe("ws://test:3001");
  });
});

describe("listEnabledQQAccounts", () => {
  it("returns only enabled accounts", () => {
    const cfg: MoltbotConfig = {
      channels: {
        qq: {
          accounts: {
            enabled1: { wsUrl: "ws://1:3001", enabled: true },
            disabled1: { wsUrl: "ws://2:3001", enabled: false },
            enabled2: { wsUrl: "ws://3:3001" }, // default enabled
          },
        },
      },
    };
    const accounts = listEnabledQQAccounts(cfg);
    expect(accounts).toHaveLength(2);
    expect(accounts.map((a) => a.accountId)).toContain("enabled1");
    expect(accounts.map((a) => a.accountId)).toContain("enabled2");
  });

  it("returns empty array when all accounts disabled", () => {
    const cfg: MoltbotConfig = {
      channels: {
        qq: {
          enabled: false,
          wsUrl: "ws://localhost:3001",
        },
      },
    };
    const accounts = listEnabledQQAccounts(cfg);
    expect(accounts).toHaveLength(0);
  });
});

describe("isQQAccountConfigured", () => {
  it("returns true when wsUrl is set", () => {
    const account = {
      accountId: "test",
      enabled: true,
      wsUrl: "ws://localhost:3001",
      config: {},
    };
    expect(isQQAccountConfigured(account)).toBe(true);
  });

  it("returns false when wsUrl is empty", () => {
    const account = {
      accountId: "test",
      enabled: true,
      wsUrl: "",
      config: {},
    };
    expect(isQQAccountConfigured(account)).toBe(false);
  });

  it("returns false for undefined account", () => {
    expect(isQQAccountConfigured(undefined)).toBe(false);
  });
});

describe("getQQAccountDefaults", () => {
  it("returns default values when not specified in config", () => {
    const account = {
      accountId: "test",
      enabled: true,
      wsUrl: "ws://localhost:3001",
      config: {},
    };
    const defaults = getQQAccountDefaults(account);
    expect(defaults.textChunkLimit).toBe(QQ_DEFAULT_TEXT_CHUNK_LIMIT);
    expect(defaults.mediaMaxMb).toBe(30);
    expect(defaults.timeoutSeconds).toBe(30);
    expect(defaults.reconnectIntervalMs).toBe(5000);
    expect(defaults.heartbeatIntervalMs).toBe(30000);
  });

  it("uses config values when specified", () => {
    const account = {
      accountId: "test",
      enabled: true,
      wsUrl: "ws://localhost:3001",
      config: {
        textChunkLimit: 2000,
        mediaMaxMb: 10,
        timeoutSeconds: 60,
      },
    };
    const defaults = getQQAccountDefaults(account);
    expect(defaults.textChunkLimit).toBe(2000);
    expect(defaults.mediaMaxMb).toBe(10);
    expect(defaults.timeoutSeconds).toBe(60);
  });
});
