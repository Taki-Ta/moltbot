/**
 * QQ Channel Onboarding Adapter
 *
 * Provides CLI wizard support for `moltbot configure --section channels` and `moltbot onboard`.
 */

import {
  addWildcardAllowFrom,
  formatDocsLink,
  promptAccountId,
  type ChannelOnboardingAdapter,
  type ChannelOnboardingDmPolicy,
  type MoltbotConfig,
  type WizardPrompter,
} from "openclaw/plugin-sdk";

import {
  isQQAccountConfigured,
  listQQAccountIds,
  resolveDefaultQQAccountId,
  resolveQQAccount,
} from "./accounts.js";
import { QQ_DEFAULT_WS_URL } from "./config-schema.js";
import type { QQAccountConfig } from "./types.js";

// ============================================================================
// Types
// ============================================================================

type DmPolicy = "pairing" | "allowlist" | "open" | "disabled";

interface QQConfig {
  channels?: {
    qq?: QQAccountConfig & {
      accounts?: Record<string, QQAccountConfig | undefined>;
    };
  };
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Set the DM policy for QQ channel.
 * When policy is "open", adds wildcard to allowFrom.
 */
function setQQDmPolicy(cfg: MoltbotConfig, policy: DmPolicy): MoltbotConfig {
  const qq = (cfg as QQConfig).channels?.qq;
  const allowFrom =
    policy === "open" ? addWildcardAllowFrom(qq?.allowFrom?.map(String)) : undefined;

  return {
    ...cfg,
    channels: {
      ...cfg.channels,
      qq: {
        ...qq,
        dmPolicy: policy,
        ...(allowFrom ? { allowFrom } : {}),
      },
    },
  } as MoltbotConfig;
}

/**
 * Show setup help for QQ/NapCatQQ.
 */
async function noteQQSetupHelp(prompter: WizardPrompter): Promise<void> {
  await prompter.note(
    [
      "QQ requires NapCatQQ (or compatible OneBot v11 implementation) running.",
      "",
      "Setup steps:",
      "1. Install NapCatQQ and log in with your QQ account",
      "2. Enable the OneBot v11 WebSocket server in NapCatQQ settings",
      `3. Default WebSocket URL: ${QQ_DEFAULT_WS_URL}`,
      "4. Optional: Configure an access token for authentication",
      "",
      `Docs: ${formatDocsLink("/channels/qq", "channels/qq")}`,
    ].join("\n"),
    "QQ setup",
  );
}

/**
 * Prompt for QQ allowFrom entries.
 * QQ user IDs are purely numeric, no API resolution needed.
 */
async function promptQQAllowFrom(params: {
  cfg: MoltbotConfig;
  prompter: WizardPrompter;
  accountId?: string;
}): Promise<MoltbotConfig> {
  const { cfg, prompter, accountId } = params;
  const qq = (cfg as QQConfig).channels?.qq;

  // Get existing allowFrom based on account type
  const isNamedAccount = accountId && accountId !== "default";
  const existingAllowFrom = isNamedAccount
    ? (qq?.accounts?.[accountId]?.allowFrom ?? []).map(String)
    : (qq?.allowFrom ?? []).map(String);

  const parseInput = (raw: string): string[] =>
    raw
      .split(/[\n,;]+/g)
      .map((entry) => entry.trim())
      .filter(Boolean);

  const isValidQQId = (value: string): boolean => /^\d{5,15}$/.test(value);

  while (true) {
    const entry = await prompter.text({
      message: "QQ allowFrom (QQ user IDs, comma-separated)",
      placeholder: "123456789, 987654321",
      initialValue: existingAllowFrom[0] || undefined,
      validate: (value) => (String(value ?? "").trim() ? undefined : "Required"),
    });

    const parts = parseInput(String(entry));
    const validIds: string[] = [];
    const invalid: string[] = [];

    for (const part of parts) {
      if (isValidQQId(part)) {
        validIds.push(part);
      } else {
        invalid.push(part);
      }
    }

    if (invalid.length > 0) {
      await prompter.note(
        `Invalid QQ IDs (must be 5-15 digits): ${invalid.join(", ")}`,
        "QQ allowlist",
      );
      continue;
    }

    const unique = [...new Set([...existingAllowFrom.filter(Boolean), ...validIds])];

    // Apply to appropriate location
    if (isNamedAccount) {
      return {
        ...cfg,
        channels: {
          ...cfg.channels,
          qq: {
            ...qq,
            enabled: true,
            accounts: {
              ...qq?.accounts,
              [accountId]: {
                ...qq?.accounts?.[accountId],
                allowFrom: unique,
              },
            },
          },
        },
      } as MoltbotConfig;
    }

    return {
      ...cfg,
      channels: {
        ...cfg.channels,
        qq: {
          ...qq,
          enabled: true,
          dmPolicy: "allowlist",
          allowFrom: unique,
        },
      },
    } as MoltbotConfig;
  }
}

// ============================================================================
// DM Policy Configuration
// ============================================================================

const dmPolicy: ChannelOnboardingDmPolicy = {
  label: "QQ",
  channel: "qq",
  policyKey: "channels.qq.dmPolicy",
  allowFromKey: "channels.qq.allowFrom",
  getCurrent: (cfg) => (cfg as QQConfig).channels?.qq?.dmPolicy ?? "pairing",
  setPolicy: (cfg, policy) => setQQDmPolicy(cfg as MoltbotConfig, policy as DmPolicy),
  promptAllowFrom: promptQQAllowFrom,
};

// ============================================================================
// Onboarding Adapter
// ============================================================================

export const qqOnboardingAdapter: ChannelOnboardingAdapter = {
  channel: "qq",

  getStatus: async ({ cfg }) => {
    const accountIds = listQQAccountIds(cfg);
    const anyConfigured = accountIds.some((accountId) => {
      const account = resolveQQAccount({ cfg, accountId });
      return isQQAccountConfigured(account);
    });

    return {
      channel: "qq",
      configured: anyConfigured,
      statusLines: [
        `QQ: ${anyConfigured ? "configured" : "needs NapCatQQ WebSocket URL"}`,
      ],
      selectionHint: anyConfigured ? "configured" : "needs NapCatQQ setup",
      // Lower quickstart score than Telegram - QQ requires external NapCatQQ setup
      quickstartScore: anyConfigured ? 50 : 20,
    };
  },

  configure: async ({ cfg, prompter, shouldPromptAccountIds, forceAllowFrom }) => {
    let next = cfg as MoltbotConfig;
    const qq = (next as QQConfig).channels?.qq;

    // Handle account ID selection for multi-account support
    const defaultAccountId = resolveDefaultQQAccountId(next);
    let accountId = defaultAccountId;

    if (shouldPromptAccountIds) {
      accountId = await promptAccountId({
        cfg: next,
        prompter,
        label: "QQ",
        currentId: accountId,
        listAccountIds: listQQAccountIds,
        defaultAccountId,
      });
    }

    const isNamedAccount = accountId !== "default";

    // Get existing config for this account
    const existingAccount = resolveQQAccount({ cfg: next, accountId });
    const existingWsUrl = existingAccount?.wsUrl;
    const existingAccessToken = existingAccount?.accessToken;

    // Show setup help if not configured
    if (!existingAccount || !isQQAccountConfigured(existingAccount)) {
      await noteQQSetupHelp(prompter);
    }

    // Handle existing configuration
    let wsUrl = existingWsUrl || "";
    let accessToken = existingAccessToken || "";

    if (existingWsUrl) {
      const keep = await prompter.confirm({
        message: `QQ WebSocket URL already configured (${existingWsUrl}). Keep it?`,
        initialValue: true,
      });
      if (!keep) {
        wsUrl = "";
        accessToken = "";
      }
    }

    // Prompt for WebSocket URL if needed
    if (!wsUrl) {
      wsUrl = String(
        await prompter.text({
          message: "NapCatQQ WebSocket URL",
          initialValue: QQ_DEFAULT_WS_URL,
          validate: (value) => {
            const raw = String(value ?? "").trim();
            if (!raw) return "Required";
            if (!/^wss?:\/\//i.test(raw)) return "Use a WebSocket URL (ws:// or wss://)";
            return undefined;
          },
        }),
      ).trim();
    }

    // Prompt for access token (optional)
    if (!accessToken) {
      accessToken = String(
        await prompter.text({
          message: "Access token (optional, leave empty if not configured in NapCatQQ)",
          placeholder: "your-access-token",
        }),
      ).trim();
    }

    // Apply configuration
    if (isNamedAccount) {
      // Named account: store in accounts section
      next = {
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
    } else {
      // Default account: store at base level
      next = {
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
    }

    // Handle allowFrom if forced
    if (forceAllowFrom) {
      next = await promptQQAllowFrom({ cfg: next, prompter, accountId });
    }

    return { cfg: next };
  },

  dmPolicy,

  disable: (cfg) => ({
    ...(cfg as QQConfig),
    channels: {
      ...(cfg as QQConfig).channels,
      qq: { ...(cfg as QQConfig).channels?.qq, enabled: false },
    },
  }),
};
