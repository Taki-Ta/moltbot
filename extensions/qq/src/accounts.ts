/**
 * QQ Account Resolution and Management
 *
 * Handles account configuration resolution, supporting both single-account
 * and multi-account configurations.
 */

import type { MoltbotConfig } from "openclaw/plugin-sdk";
import { DEFAULT_ACCOUNT_ID, normalizeAccountId } from "openclaw/plugin-sdk";

import {
  QQ_DEFAULT_WS_URL,
  QQ_DEFAULT_TEXT_CHUNK_LIMIT,
  QQ_DEFAULT_MEDIA_MAX_MB,
  QQ_DEFAULT_TIMEOUT_SECONDS,
  QQ_DEFAULT_RECONNECT_INTERVAL_MS,
  QQ_DEFAULT_HEARTBEAT_INTERVAL_MS,
} from "./config-schema.js";
import type { QQAccountConfig, ResolvedQQAccount } from "./types.js";

// ============================================================================
// Debug Logging
// ============================================================================

const debugAccounts = (...args: unknown[]) => {
  if (process.env.CLAWDBOT_DEBUG_QQ_ACCOUNTS) {
    console.warn("[qq:accounts]", ...args);
  }
};

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Get the raw QQ configuration section from MoltbotConfig.
 */
function getQQConfigSection(cfg: MoltbotConfig): Record<string, unknown> | undefined {
  return cfg.channels?.qq as Record<string, unknown> | undefined;
}

/**
 * List account IDs that are explicitly configured in the accounts object.
 */
function listConfiguredAccountIds(cfg: MoltbotConfig): string[] {
  const qq = getQQConfigSection(cfg);
  const accounts = qq?.accounts as Record<string, unknown> | undefined;
  if (!accounts || typeof accounts !== "object") return [];

  const ids = new Set<string>();
  for (const key of Object.keys(accounts)) {
    if (!key) continue;
    ids.add(normalizeAccountId(key));
  }
  return [...ids];
}

/**
 * Check if base-level (non-accounts) QQ config exists.
 */
function hasBaseLevelConfig(cfg: MoltbotConfig): boolean {
  const qq = getQQConfigSection(cfg);
  if (!qq) return false;
  return Boolean(qq.wsUrl || qq.httpUrl || qq.accessToken || qq.enabled !== undefined);
}

/**
 * Get account config from the accounts object.
 */
function getAccountConfig(
  cfg: MoltbotConfig,
  accountId: string,
): Record<string, unknown> | undefined {
  const qq = getQQConfigSection(cfg);
  const accounts = qq?.accounts as Record<string, Record<string, unknown>> | undefined;
  if (!accounts || typeof accounts !== "object") return undefined;

  // Direct lookup
  const direct = accounts[accountId];
  if (direct) return direct;

  // Normalized lookup
  const normalized = normalizeAccountId(accountId);
  const matchKey = Object.keys(accounts).find((key) => normalizeAccountId(key) === normalized);
  return matchKey ? accounts[matchKey] : undefined;
}

/**
 * Merge base-level config with account-specific config.
 * Account-specific values override base-level values.
 */
function mergeAccountConfig(cfg: MoltbotConfig, accountId: string): QQAccountConfig {
  const qq = getQQConfigSection(cfg);
  if (!qq) return {} as QQAccountConfig;

  // Extract base config (excluding accounts)
  const { accounts: _ignored, ...baseConfig } = qq;

  // Get account-specific config
  const accountConfig = getAccountConfig(cfg, accountId) ?? {};

  // Merge: account config overrides base config
  return { ...baseConfig, ...accountConfig } as QQAccountConfig;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * List all QQ account IDs.
 *
 * Includes:
 * - Explicitly configured accounts from `channels.qq.accounts`
 * - Implicit "default" account if base-level config exists
 *
 * @returns Array of account IDs, sorted alphabetically
 */
export function listQQAccountIds(cfg: MoltbotConfig): string[] {
  const explicitIds = listConfiguredAccountIds(cfg);
  const ids = new Set<string>(explicitIds);

  // Add implicit "default" if base-level config exists
  if (hasBaseLevelConfig(cfg) && !ids.has(DEFAULT_ACCOUNT_ID)) {
    ids.add(DEFAULT_ACCOUNT_ID);
  }

  const result = [...ids].sort((a, b) => a.localeCompare(b));
  debugAccounts("listQQAccountIds", result);

  // Return at least DEFAULT_ACCOUNT_ID if no accounts configured
  if (result.length === 0) return [DEFAULT_ACCOUNT_ID];
  return result;
}

/**
 * Resolve the default QQ account ID.
 *
 * Priority:
 * 1. "default" if it exists
 * 2. First configured account
 * 3. Fallback to "default"
 */
export function resolveDefaultQQAccountId(cfg: MoltbotConfig): string {
  const ids = listQQAccountIds(cfg);
  if (ids.includes(DEFAULT_ACCOUNT_ID)) return DEFAULT_ACCOUNT_ID;
  return ids[0] ?? DEFAULT_ACCOUNT_ID;
}

/**
 * Resolve a QQ account by ID.
 *
 * Merges base-level config with account-specific config.
 * Applies default values for missing fields.
 *
 * @param params.cfg - The Moltbot configuration
 * @param params.accountId - The account ID to resolve (defaults to "default")
 * @returns Resolved account or undefined if not configured
 */
export function resolveQQAccount(params: {
  cfg: MoltbotConfig;
  accountId?: string | null;
}): ResolvedQQAccount | undefined {
  const { cfg, accountId: rawAccountId } = params;
  const accountId = normalizeAccountId(rawAccountId) || DEFAULT_ACCOUNT_ID;

  const qq = getQQConfigSection(cfg);
  if (!qq) {
    debugAccounts("resolveQQAccount: no QQ config section");
    return undefined;
  }

  // Check if this account exists
  const accountIds = listQQAccountIds(cfg);
  const accountExists =
    accountIds.includes(accountId) ||
    (accountId === DEFAULT_ACCOUNT_ID && hasBaseLevelConfig(cfg));

  if (!accountExists) {
    debugAccounts("resolveQQAccount: account not found", accountId);
    return undefined;
  }

  // Merge configs
  const merged = mergeAccountConfig(cfg, accountId);

  // Check enabled status
  const baseEnabled = qq.enabled !== false;
  const accountEnabled = merged.enabled !== false;
  const enabled = baseEnabled && accountEnabled;

  // Resolve wsUrl with default
  const wsUrl = (merged.wsUrl as string)?.trim() || QQ_DEFAULT_WS_URL;

  const resolved: ResolvedQQAccount = {
    accountId,
    name: (merged.name as string)?.trim() || undefined,
    enabled,
    wsUrl,
    httpUrl: (merged.httpUrl as string)?.trim() || undefined,
    accessToken: (merged.accessToken as string)?.trim() || undefined,
    config: merged,
  };

  debugAccounts("resolveQQAccount", {
    accountId,
    enabled,
    wsUrl: resolved.wsUrl,
    hasAccessToken: Boolean(resolved.accessToken),
  });

  return resolved;
}

/**
 * List all enabled QQ accounts.
 */
export function listEnabledQQAccounts(cfg: MoltbotConfig): ResolvedQQAccount[] {
  return listQQAccountIds(cfg)
    .map((accountId) => resolveQQAccount({ cfg, accountId }))
    .filter((account): account is ResolvedQQAccount => account !== undefined && account.enabled);
}

/**
 * Check if an account is configured (has wsUrl).
 */
export function isQQAccountConfigured(account: ResolvedQQAccount | undefined): boolean {
  return Boolean(account?.wsUrl);
}

/**
 * Get effective config values with defaults applied.
 */
export function getQQAccountDefaults(account: ResolvedQQAccount): {
  textChunkLimit: number;
  mediaMaxMb: number;
  timeoutSeconds: number;
  reconnectIntervalMs: number;
  heartbeatIntervalMs: number;
} {
  const config = account.config;
  return {
    textChunkLimit:
      (config.textChunkLimit as number | undefined) ?? QQ_DEFAULT_TEXT_CHUNK_LIMIT,
    mediaMaxMb: (config.mediaMaxMb as number | undefined) ?? QQ_DEFAULT_MEDIA_MAX_MB,
    timeoutSeconds:
      (config.timeoutSeconds as number | undefined) ?? QQ_DEFAULT_TIMEOUT_SECONDS,
    reconnectIntervalMs:
      (config.reconnectIntervalMs as number | undefined) ?? QQ_DEFAULT_RECONNECT_INTERVAL_MS,
    heartbeatIntervalMs:
      (config.heartbeatIntervalMs as number | undefined) ?? QQ_DEFAULT_HEARTBEAT_INTERVAL_MS,
  };
}

// Re-export for convenience
export { DEFAULT_ACCOUNT_ID };
