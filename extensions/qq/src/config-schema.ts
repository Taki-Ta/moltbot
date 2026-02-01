/**
 * QQ Channel Configuration Schema (Zod)
 *
 * Reference: TelegramConfigSchema in src/config/zod-schema.providers-core.ts
 */

import { z } from "zod";
import {
  DmPolicySchema,
  GroupPolicySchema,
  MarkdownConfigSchema,
  ToolPolicySchema,
  normalizeAllowFrom,
} from "openclaw/plugin-sdk";

// ============================================================================
// Local Schema Definitions (not exported from plugin-sdk)
// ============================================================================

/** Reply threading mode */
const ReplyToModeSchema = z.union([z.literal("off"), z.literal("first"), z.literal("all")]);

/** Retry configuration */
const RetryConfigSchema = z
  .object({
    attempts: z.number().int().min(1).optional(),
    minDelayMs: z.number().int().min(0).optional(),
    maxDelayMs: z.number().int().min(0).optional(),
    jitter: z.number().min(0).max(1).optional(),
  })
  .strict()
  .optional();

// ============================================================================
// Group Configuration
// ============================================================================

export const QQGroupSchema = z
  .object({
    /** Whether the group is enabled */
    enabled: z.boolean().optional(),
    /** Whether to require @mention to trigger */
    requireMention: z.boolean().optional(),
    /** Tool policy for this group */
    tools: ToolPolicySchema,
    /** Tool policy by sender */
    toolsBySender: z.record(z.string(), ToolPolicySchema).optional(),
    /** Skills to enable for this group */
    skills: z.array(z.string()).optional(),
    /** Allowed senders in this group */
    allowFrom: z.array(z.union([z.string(), z.number()])).optional(),
    /** Custom system prompt for this group */
    systemPrompt: z.string().optional(),
  })
  .strict();

// ============================================================================
// Account Configuration (Base)
// ============================================================================

export const QQAccountSchemaBase = z
  .object({
    /** Display name for this account */
    name: z.string().optional(),
    /** Whether this account is enabled */
    enabled: z.boolean().optional(),

    // Connection settings
    /** WebSocket URL for OneBot connection (e.g., "ws://127.0.0.1:3001") */
    wsUrl: z.string().optional(),
    /** HTTP URL for OneBot API (optional, for hybrid mode) */
    httpUrl: z.string().optional(),
    /** Access token for authentication */
    accessToken: z.string().optional(),

    // DM settings
    /** DM access policy */
    dmPolicy: DmPolicySchema.optional().default("pairing"),
    /** Allowed users for DM (when dmPolicy is "allowlist" or "open") */
    allowFrom: z.array(z.union([z.string(), z.number()])).optional(),
    /** DM history limit */
    dmHistoryLimit: z.number().int().min(0).optional(),

    // Group settings
    /** Group access policy */
    groupPolicy: GroupPolicySchema.optional().default("allowlist"),
    /** Allowed users in groups */
    groupAllowFrom: z.array(z.union([z.string(), z.number()])).optional(),
    /** Group-specific configurations */
    groups: z.record(z.string(), QQGroupSchema.optional()).optional(),
    /** Group history limit */
    historyLimit: z.number().int().min(0).optional(),

    // Message settings
    /** Reply mode */
    replyToMode: ReplyToModeSchema.optional(),
    /** Markdown rendering config */
    markdown: MarkdownConfigSchema,
    /** Max characters per message chunk */
    textChunkLimit: z.number().int().positive().optional(),

    // Media settings
    /** Max media file size in MB */
    mediaMaxMb: z.number().positive().optional(),

    // Network settings
    /** Request timeout in seconds */
    timeoutSeconds: z.number().int().positive().optional(),
    /** Retry configuration */
    retry: RetryConfigSchema,
    /** Reconnect interval in ms */
    reconnectIntervalMs: z.number().int().positive().optional(),
    /** Heartbeat interval in ms */
    heartbeatIntervalMs: z.number().int().positive().optional(),
  })
  .strict();

// ============================================================================
// Validation Helper
// ============================================================================

const requireOpenAllowFrom = (params: {
  policy?: string;
  allowFrom?: Array<string | number>;
  ctx: z.RefinementCtx;
  path: Array<string | number>;
  message: string;
}) => {
  if (params.policy !== "open") return;
  const allow = normalizeAllowFrom(params.allowFrom);
  if (allow.includes("*")) return;
  params.ctx.addIssue({
    code: z.ZodIssueCode.custom,
    path: params.path,
    message: params.message,
  });
};

// ============================================================================
// Account Configuration (with validation)
// ============================================================================

export const QQAccountSchema = QQAccountSchemaBase.superRefine((value, ctx) => {
  requireOpenAllowFrom({
    policy: value.dmPolicy,
    allowFrom: value.allowFrom,
    ctx,
    path: ["allowFrom"],
    message: 'channels.qq.dmPolicy="open" requires channels.qq.allowFrom to include "*"',
  });
});

// ============================================================================
// Full QQ Configuration (supports multi-account)
// ============================================================================

export const QQConfigSchema = QQAccountSchemaBase.extend({
  /** Named accounts for multi-account support */
  accounts: z.record(z.string(), QQAccountSchema.optional()).optional(),
}).superRefine((value, ctx) => {
  requireOpenAllowFrom({
    policy: value.dmPolicy,
    allowFrom: value.allowFrom,
    ctx,
    path: ["allowFrom"],
    message: 'channels.qq.dmPolicy="open" requires channels.qq.allowFrom to include "*"',
  });
});

// ============================================================================
// Default Values
// ============================================================================

export const QQ_DEFAULT_WS_URL = "ws://127.0.0.1:3001";
export const QQ_DEFAULT_TEXT_CHUNK_LIMIT = 4500;
export const QQ_DEFAULT_MEDIA_MAX_MB = 30;
export const QQ_DEFAULT_TIMEOUT_SECONDS = 30;
export const QQ_DEFAULT_RECONNECT_INTERVAL_MS = 5000;
export const QQ_DEFAULT_HEARTBEAT_INTERVAL_MS = 30000;
