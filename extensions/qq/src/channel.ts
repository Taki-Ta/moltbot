/**
 * QQ Channel Plugin Implementation
 *
 * Complete ChannelPlugin implementation for QQ via NapCatQQ/OneBot v11.
 */

import type { ChannelPlugin, MoltbotConfig } from "clawdbot/plugin-sdk";
import {
  applyAccountNameToChannelSection,
  buildChannelConfigSchema,
  createTypingCallbacks,
  DEFAULT_ACCOUNT_ID,
  migrateBaseNameToDefaultAccount,
  normalizeAccountId,
} from "clawdbot/plugin-sdk";

import {
  listQQAccountIds,
  resolveDefaultQQAccountId,
  resolveQQAccount,
  isQQAccountConfigured,
} from "./accounts.js";
import { QQConfigSchema, QQ_DEFAULT_WS_URL } from "./config-schema.js";
import { QQConnectionManager, createConnectionManager } from "./connection.js";
import { parseQQTarget, normalizeQQMessagingTarget, looksLikeQQTargetId } from "./normalize.js";
import { qqOnboardingAdapter } from "./onboarding.js";
import { sendQQTextMessage, sendQQMediaMessage, setQQTypingStatus } from "./send.js";
import { isBotMentioned, removeBotMention } from "./monitor.js";
import { getQQRuntime } from "./runtime.js";
import type {
  ResolvedQQAccount,
  QQConnectionState,
  QQParsedMessage,
  QQAccountConfig,
} from "./types.js";

// ============================================================================
// Type Helpers
// ============================================================================

interface QQConfig {
  channels?: {
    qq?: QQAccountConfig & {
      accounts?: Record<string, QQAccountConfig | undefined>;
    };
  };
}

// ============================================================================
// Channel Metadata
// ============================================================================

const QQ_CHANNEL_META = {
  id: "qq" as const,
  label: "QQ",
  selectionLabel: "QQ (NapCatQQ/OneBot)",
  detailLabel: "QQ Bot",
  docsPath: "/channels/qq",
  docsLabel: "qq",
  blurb: "QQ messaging via NapCatQQ/OneBot v11 protocol.",
  systemImage: "bubble.left.and.bubble.right",
};

// ============================================================================
// Connection Management
// ============================================================================

/** Active connections by account ID */
const activeConnections = new Map<string, QQConnectionManager>();

/** Runtime status by account ID */
const accountStatus = new Map<
  string,
  {
    running: boolean;
    lastStartAt: number | null;
    lastStopAt: number | null;
    lastError: string | null;
    lastInboundAt: number | null;
    lastOutboundAt: number | null;
  }
>();

/**
 * Get or create status record for an account.
 */
function getAccountStatus(accountId: string) {
  if (!accountStatus.has(accountId)) {
    accountStatus.set(accountId, {
      running: false,
      lastStartAt: null,
      lastStopAt: null,
      lastError: null,
      lastInboundAt: null,
      lastOutboundAt: null,
    });
  }
  return accountStatus.get(accountId)!;
}

// ============================================================================
// Channel Plugin Definition
// ============================================================================

export const qqPlugin: ChannelPlugin<ResolvedQQAccount> = {
  id: "qq",
  meta: QQ_CHANNEL_META,

  // ==========================================================================
  // Onboarding Adapter - CLI Wizard Support
  // ==========================================================================
  onboarding: qqOnboardingAdapter,

  // ==========================================================================
  // Setup Adapter - Account Configuration
  // ==========================================================================
  setup: {
    resolveAccountId: ({ accountId }) => normalizeAccountId(accountId),
    applyAccountName: ({ cfg, accountId, name }) =>
      applyAccountNameToChannelSection({
        cfg: cfg as QQConfig,
        channelKey: "qq",
        accountId,
        name,
      }),
    validateInput: ({ input }) => {
      // QQ has a default wsUrl, so it's always minimally configured
      // Validate URL format if provided
      const url = (input.url ?? "").trim();
      if (url && !/^wss?:\/\//i.test(url)) {
        return "QQ WebSocket URL must start with ws:// or wss://";
      }
      return null;
    },
    applyAccountConfig: ({ cfg, accountId, input }) => {
      const namedConfig = applyAccountNameToChannelSection({
        cfg: cfg as QQConfig,
        channelKey: "qq",
        accountId,
        name: input.name,
      });

      // Migrate base name to default account if working with named account
      const next =
        accountId !== DEFAULT_ACCOUNT_ID
          ? migrateBaseNameToDefaultAccount({ cfg: namedConfig as MoltbotConfig, channelKey: "qq" })
          : namedConfig;

      // Build the config update
      const qq = (next as QQConfig).channels?.qq;
      const wsUrl = (input.url ?? "").trim() || QQ_DEFAULT_WS_URL;
      const accessToken = (input.accessToken ?? "").trim();

      if (accountId !== DEFAULT_ACCOUNT_ID) {
        // Named account: store in accounts section
        return {
          ...next,
          channels: {
            ...next.channels,
            qq: {
              ...qq,
              enabled: true,
              accounts: {
                ...qq?.accounts,
                [accountId]: {
                  ...qq?.accounts?.[accountId],
                  enabled: true,
                  wsUrl,
                  ...(accessToken ? { accessToken } : {}),
                },
              },
            },
          },
        } as MoltbotConfig;
      }

      // Default account: store at base level
      return {
        ...next,
        channels: {
          ...next.channels,
          qq: {
            ...qq,
            enabled: true,
            wsUrl,
            ...(accessToken ? { accessToken } : {}),
          },
        },
      } as MoltbotConfig;
    },
  },

  capabilities: {
    chatTypes: ["direct", "group"],
    media: true,
    reactions: false,
    threads: false,
    polls: false,
    nativeCommands: false,
  },

  reload: { configPrefixes: ["channels.qq"] },

  configSchema: buildChannelConfigSchema(QQConfigSchema),

  // ==========================================================================
  // Config Adapter
  // ==========================================================================
  config: {
    listAccountIds: (cfg) => listQQAccountIds(cfg),
    resolveAccount: (cfg, accountId) => resolveQQAccount({ cfg, accountId }),
    defaultAccountId: (cfg) => resolveDefaultQQAccountId(cfg),
    isConfigured: (account) => isQQAccountConfigured(account),
    isEnabled: (account) => account?.enabled !== false,
    describeAccount: (account) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: isQQAccountConfigured(account),
    }),
  },

  // ==========================================================================
  // Gateway Adapter - Connection Lifecycle
  // ==========================================================================
  gateway: {
    startAccount: async (ctx) => {
      const account = ctx.account;
      const accountId = ctx.accountId;
      const core = getQQRuntime();

      if (activeConnections.has(accountId)) {
        return;
      }

      ctx.log?.info(`[${accountId}] starting QQ provider (${account.wsUrl})`);

      const manager = createConnectionManager({
        account,
        onMessage: async (message: QQParsedMessage) => {
          const status = getAccountStatus(accountId);
          status.lastInboundAt = Date.now();

          const isGroup = message.chatType === "group";
          const isPrivate = message.chatType === "private";

          // Check group mention requirement
          if (isGroup) {
            const state = manager.getState();
            const requireMention =
              account.config.groups?.[String(message.groupId)]?.requireMention;
            if (requireMention && state.selfId) {
              if (!isBotMentioned(message, state.selfId)) {
                return;
              }
              message.text = removeBotMention(message.text, state.nickname);
            }
          }

          // Route message to agent
          const currentCfg = core.config.loadConfig();
          const route = core.channel.routing.resolveAgentRoute({
            cfg: currentCfg,
            channel: "qq",
            accountId,
            peer: {
              kind: isPrivate ? "dm" : "channel",
              id: isPrivate
                ? message.senderId
                : String(message.groupId ?? message.chatId),
            },
          });

          // Build inbound context
          const ctxPayload = core.channel.reply.finalizeInboundContext({
            Body: message.text,
            RawBody: message.rawMessage,
            CommandBody: message.text,
            From: message.chatId,
            To: message.chatId,
            SessionKey: route.sessionKey,
            AccountId: route.accountId,
            ChatType: isPrivate ? "direct" : "group",
            ConversationLabel: message.senderName,
            SenderName: message.senderName,
            SenderId: message.senderId,
            GroupSubject:
              isGroup && message.groupId
                ? `QQ Group ${message.groupId}`
                : undefined,
            Provider: "qq",
            Surface: "qq",
            WasMentioned: isGroup
              ? Boolean(message.mentions?.length)
              : undefined,
            MessageSid: message.messageId,
            ReplyToId: message.replyToId,
            Timestamp: message.timestamp,
            MediaPath: message.mediaUrls?.[0],
            MediaUrl: message.mediaUrls?.[0],
            CommandAuthorized: true,
            CommandSource: "text",
            OriginatingChannel: "qq",
            OriginatingTo: message.chatId,
          });

          // Create reply dispatcher
          const humanDelay = core.channel.reply.resolveHumanDelayConfig(
            currentCfg,
            route.agentId,
          );

          // Create typing callbacks (only for private chats)
          const typingCallbacks = isPrivate
            ? createTypingCallbacks({
                start: async () => {
                  const api = manager.getApi();
                  if (api) await setQQTypingStatus(api, message.senderId, true);
                },
                stop: async () => {
                  const api = manager.getApi();
                  if (api) await setQQTypingStatus(api, message.senderId, false);
                },
                onStartError: (err) => {
                  ctx.log?.debug?.(
                    `[${accountId}] typing start failed: ${String(err)}`,
                  );
                },
                onStopError: (err) => {
                  ctx.log?.debug?.(
                    `[${accountId}] typing stop failed: ${String(err)}`,
                  );
                },
              })
            : undefined;

          const { dispatcher, replyOptions, markDispatchIdle } =
            core.channel.reply.createReplyDispatcherWithTyping({
              humanDelay,
              deliver: async (payload) => {
                const api = manager.getApi();
                if (!api) return;

                if (payload.text) {
                  const result = await sendQQTextMessage(api, {
                    target: message.chatId,
                    text: payload.text,
                  });
                  if (!result.ok) {
                    ctx.log?.error(
                      `[${accountId}] send failed: ${result.error}`,
                    );
                  }
                }
                if (payload.mediaUrl) {
                  const result = await sendQQMediaMessage(api, {
                    target: message.chatId,
                    mediaType: "image",
                    file: payload.mediaUrl,
                  });
                  if (!result.ok) {
                    ctx.log?.error(
                      `[${accountId}] media send failed: ${result.error}`,
                    );
                  }
                }
                status.lastOutboundAt = Date.now();
              },
              onError: (err, info) => {
                ctx.log?.error(
                  `[${accountId}] ${info.kind} reply failed: ${String(err)}`,
                );
              },
              onReplyStart: typingCallbacks?.onReplyStart,
              onIdle: typingCallbacks?.onIdle,
            });

          // Dispatch to auto-reply pipeline
          try {
            await core.channel.reply.dispatchReplyFromConfig({
              ctx: ctxPayload,
              cfg: currentCfg,
              dispatcher,
              replyOptions,
            });
            markDispatchIdle();
          } catch (err) {
            ctx.log?.error(
              `[${accountId}] dispatch failed: ${String(err)}`,
            );
            markDispatchIdle();
          }
        },
        onStateChange: (state: QQConnectionState) => {
          ctx.setStatus({
            accountId,
            running: true,
            connected: state.connected,
            selfId: state.selfId,
            nickname: state.nickname,
          });
        },
        onError: (error: Error) => {
          const status = getAccountStatus(accountId);
          status.lastError = error.message;
          ctx.log?.error(`[${accountId}] error: ${error.message}`);
        },
        onLog: (level, msg) => {
          const fn = ctx.log?.[level];
          if (typeof fn === "function") fn(msg);
        },
      });

      activeConnections.set(accountId, manager);
      const status = getAccountStatus(accountId);
      status.running = true;
      status.lastStartAt = Date.now();
      status.lastError = null;

      try {
        await manager.connect();
      } catch (err) {
        status.lastError = err instanceof Error ? err.message : String(err);
        status.running = false;
        activeConnections.delete(accountId);
        throw err;
      }

      // Block until abort signal fires (gateway handles lifecycle)
      await new Promise<void>((resolve) => {
        const onAbort = () => {
          ctx.log?.info(`[${accountId}] stopping QQ provider`);
          manager
            .disconnect()
            .catch((err) => {
              ctx.log?.error(
                `[${accountId}] disconnect error: ${String(err)}`,
              );
            })
            .finally(() => {
              activeConnections.delete(accountId);
              status.running = false;
              status.lastStopAt = Date.now();
              resolve();
            });
        };
        if (ctx.abortSignal.aborted) {
          onAbort();
          return;
        }
        ctx.abortSignal.addEventListener("abort", onAbort, { once: true });
      });
    },

    stopAccount: async (ctx) => {
      const manager = activeConnections.get(ctx.accountId);
      if (manager) {
        ctx.log?.info(`[${ctx.accountId}] stopping QQ provider`);
        await manager.disconnect();
        activeConnections.delete(ctx.accountId);
        const status = getAccountStatus(ctx.accountId);
        status.running = false;
        status.lastStopAt = Date.now();
      }
    },
  },

  // ==========================================================================
  // Messaging Adapter - Target Handling
  // ==========================================================================
  messaging: {
    normalizeTarget: (raw) => normalizeQQMessagingTarget(raw),
    looksLikeTarget: (raw) => looksLikeQQTargetId(raw),

    parseTarget: (normalized) => {
      const parsed = parseQQTarget(normalized);
      if (!parsed) return undefined;

      return {
        type: parsed.type === "group" ? "group" : "direct",
        id: String(parsed.id),
        displayName: normalized,
      };
    },
  },

  // ==========================================================================
  // Outbound Adapter - Sending Messages
  // ==========================================================================
  outbound: {
    deliveryMode: "gateway",
    textChunkLimit: 4000,

    sendText: async ({ to, text, accountId, replyToId }) => {
      const acctId = accountId ?? "default";
      const manager = activeConnections.get(acctId);
      if (!manager?.isConnected()) {
        throw new Error("QQ not connected");
      }
      const api = manager.getApi();
      if (!api) {
        throw new Error("QQ API not available");
      }
      const result = await sendQQTextMessage(api, {
        target: to,
        text,
        replyToMessageId: replyToId ? Number(replyToId) : undefined,
      });
      if (!result.ok) {
        throw new Error(result.error);
      }
      return {
        channel: "qq" as const,
        messageId: result.messageId,
        chatId: result.chatId,
      };
    },

    sendMedia: async ({ to, text, mediaUrl, accountId, replyToId }) => {
      const acctId = accountId ?? "default";
      const manager = activeConnections.get(acctId);
      if (!manager?.isConnected()) {
        throw new Error("QQ not connected");
      }
      const api = manager.getApi();
      if (!api) {
        throw new Error("QQ API not available");
      }
      if (mediaUrl) {
        const result = await sendQQMediaMessage(api, {
          target: to,
          mediaType: "image",
          file: mediaUrl,
          caption: text,
          replyToMessageId: replyToId ? Number(replyToId) : undefined,
        });
        if (!result.ok) {
          throw new Error(result.error);
        }
        return {
          channel: "qq" as const,
          messageId: result.messageId,
          chatId: result.chatId,
        };
      }
      const result = await sendQQTextMessage(api, {
        target: to,
        text: text ?? "",
        replyToMessageId: replyToId ? Number(replyToId) : undefined,
      });
      if (!result.ok) {
        throw new Error(result.error);
      }
      return {
        channel: "qq" as const,
        messageId: result.messageId,
        chatId: result.chatId,
      };
    },
  },

  // ==========================================================================
  // Status Adapter - Runtime Status
  // ==========================================================================
  status: {
    defaultRuntime: {
      accountId: "default",
      running: false,
      lastStartAt: null,
      lastStopAt: null,
      lastError: null,
    },
    buildChannelSummary: ({ snapshot }) => ({
      configured: snapshot.configured ?? false,
      running: snapshot.running ?? false,
      lastStartAt: snapshot.lastStartAt ?? null,
      lastStopAt: snapshot.lastStopAt ?? null,
      lastError: snapshot.lastError ?? null,
    }),
    probeAccount: async ({ account, timeoutMs: _timeoutMs }) => {
      const manager = activeConnections.get(account.accountId);
      if (!manager?.isConnected()) {
        return { ok: false, error: "Not connected" };
      }
      const api = manager.getApi();
      if (!api) {
        return { ok: false, error: "API not available" };
      }
      const startTime = Date.now();
      try {
        const info = await api.getLoginInfo();
        return {
          ok: true,
          selfId: info.user_id,
          nickname: info.nickname,
          latencyMs: Date.now() - startTime,
        };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  },

  // ==========================================================================
  // Security Adapter
  // ==========================================================================
  security: {
    resolveDmPolicy: ({ account }) => {
      const dmPolicy = account.config.dmPolicy ?? "open";
      const allowFrom = account.config.allowFrom ?? [];
      return {
        policy: dmPolicy,
        allowFrom,
        allowFromPath: `channels.qq.allowFrom`,
        approveHint: "Add the QQ user ID to channels.qq.allowFrom",
      };
    },
  },
};
