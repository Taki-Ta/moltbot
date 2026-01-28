/**
 * QQ Message Monitor Module
 *
 * Handles incoming messages from OneBot WebSocket events.
 * Converts OneBot events to normalized QQ message format.
 */

import type { OneBotEvent, OneBotMessageEvent, OneBotMessageSegment } from "./onebot/types.js";
import { isMessageEvent } from "./onebot/types.js";
import type { QQChatType, QQParsedMessage } from "./types.js";

// ============================================================================
// Types
// ============================================================================

export interface MessageHandler {
  (message: QQParsedMessage): void | Promise<void>;
}

export interface MonitorOptions {
  /** Handler called for each incoming message */
  onMessage: MessageHandler;
  /** Handler called for errors */
  onError?: (error: Error) => void;
  /** Filter: only process messages from these user IDs */
  allowedUsers?: number[];
  /** Filter: only process messages from these group IDs */
  allowedGroups?: number[];
  /** Filter: ignore messages from these user IDs */
  blockedUsers?: number[];
  /** Filter: ignore messages from these group IDs */
  blockedGroups?: number[];
  /** Filter: process private messages */
  enablePrivate?: boolean;
  /** Filter: process group messages */
  enableGroup?: boolean;
}

// ============================================================================
// Message Parsing
// ============================================================================

/**
 * Extract plain text from message segments.
 */
export function extractTextFromSegments(segments: OneBotMessageSegment[]): string {
  return segments
    .filter((seg): seg is OneBotMessageSegment & { type: "text" } => seg.type === "text")
    .map((seg) => seg.data.text ?? "")
    .join("");
}

/**
 * Extract media URLs from message segments.
 */
export function extractMediaUrls(segments: OneBotMessageSegment[]): string[] {
  const urls: string[] = [];

  for (const seg of segments) {
    if (seg.type === "image" && seg.data.url) {
      urls.push(seg.data.url);
    } else if (seg.type === "record" && seg.data.url) {
      urls.push(seg.data.url);
    } else if (seg.type === "video" && seg.data.url) {
      urls.push(seg.data.url);
    }
  }

  return urls;
}

/**
 * Extract @mentions from message segments.
 */
export function extractMentions(segments: OneBotMessageSegment[]): string[] {
  return segments
    .filter((seg): seg is OneBotMessageSegment & { type: "at" } => seg.type === "at")
    .map((seg) => seg.data.qq ?? "")
    .filter((qq) => qq !== "");
}

/**
 * Extract reply message ID from message segments.
 */
export function extractReplyId(segments: OneBotMessageSegment[]): string | undefined {
  const replySegment = segments.find((seg) => seg.type === "reply");
  return replySegment?.data.id;
}

/**
 * Parse a OneBotMessageEvent into a normalized QQParsedMessage.
 */
export function parseOneBotMessage(event: OneBotMessageEvent): QQParsedMessage {
  const chatType: QQChatType = event.message_type === "group" ? "group" : "private";

  // Determine chat ID based on message type
  let chatId: string;
  if (chatType === "group" && event.group_id) {
    chatId = `qq:group:${event.group_id}`;
  } else {
    chatId = `qq:${event.user_id}`;
  }

  // Extract sender info
  const senderId = String(event.user_id);
  const senderName =
    event.sender.card || event.sender.nickname || String(event.user_id);

  // Parse message segments
  const segments = Array.isArray(event.message) ? event.message : [];
  const text = extractTextFromSegments(segments);
  const mediaUrls = extractMediaUrls(segments);
  const mentions = extractMentions(segments);
  const replyToId = extractReplyId(segments);

  return {
    messageId: String(event.message_id),
    chatType,
    chatId,
    senderId,
    senderName,
    text,
    rawMessage: event.raw_message,
    timestamp: event.time * 1000, // Convert to milliseconds
    groupId: event.group_id,
    replyToId,
    mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
    mentions: mentions.length > 0 ? mentions : undefined,
  };
}

// ============================================================================
// Monitor Class
// ============================================================================

/**
 * Message monitor that processes OneBot events and calls handlers.
 */
export class QQMessageMonitor {
  private options: Required<
    Omit<MonitorOptions, "allowedUsers" | "allowedGroups" | "blockedUsers" | "blockedGroups">
  > &
    Pick<MonitorOptions, "allowedUsers" | "allowedGroups" | "blockedUsers" | "blockedGroups">;

  constructor(options: MonitorOptions) {
    this.options = {
      onMessage: options.onMessage,
      onError: options.onError ?? (() => {}),
      allowedUsers: options.allowedUsers,
      allowedGroups: options.allowedGroups,
      blockedUsers: options.blockedUsers,
      blockedGroups: options.blockedGroups,
      enablePrivate: options.enablePrivate ?? true,
      enableGroup: options.enableGroup ?? true,
    };
  }

  /**
   * Process a OneBot event.
   * Call this from the OneBotClient's onEvent handler.
   */
  processEvent(event: OneBotEvent): void {
    if (!isMessageEvent(event)) {
      return;
    }

    // Filter by message type
    if (event.message_type === "private" && !this.options.enablePrivate) {
      return;
    }
    if (event.message_type === "group" && !this.options.enableGroup) {
      return;
    }

    // Filter by user allowlist
    if (this.options.allowedUsers && this.options.allowedUsers.length > 0) {
      if (!this.options.allowedUsers.includes(event.user_id)) {
        return;
      }
    }

    // Filter by group allowlist
    if (event.message_type === "group" && event.group_id) {
      if (this.options.allowedGroups && this.options.allowedGroups.length > 0) {
        if (!this.options.allowedGroups.includes(event.group_id)) {
          return;
        }
      }
    }

    // Filter by user blocklist
    if (this.options.blockedUsers && this.options.blockedUsers.includes(event.user_id)) {
      return;
    }

    // Filter by group blocklist
    if (event.message_type === "group" && event.group_id) {
      if (this.options.blockedGroups && this.options.blockedGroups.includes(event.group_id)) {
        return;
      }
    }

    // Parse and handle message
    try {
      const message = parseOneBotMessage(event);
      const result = this.options.onMessage(message);

      // Handle async handlers
      if (result instanceof Promise) {
        result.catch((err) => {
          this.options.onError(err instanceof Error ? err : new Error(String(err)));
        });
      }
    } catch (err) {
      this.options.onError(err instanceof Error ? err : new Error(String(err)));
    }
  }

  /**
   * Create an event handler function for use with OneBotClient.
   */
  createEventHandler(): (event: OneBotEvent) => void {
    return (event) => this.processEvent(event);
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a message monitor instance.
 */
export function createMessageMonitor(options: MonitorOptions): QQMessageMonitor {
  return new QQMessageMonitor(options);
}

/**
 * Check if a message mentions the bot.
 */
export function isBotMentioned(message: QQParsedMessage, botId: string | number): boolean {
  if (!message.mentions) return false;
  const botIdStr = String(botId);
  return message.mentions.includes(botIdStr) || message.mentions.includes("all");
}

/**
 * Check if the message is a direct reply to a specific message.
 */
export function isReplyTo(message: QQParsedMessage, messageId: string | number): boolean {
  return message.replyToId === String(messageId);
}

/**
 * Remove bot mention from message text.
 */
export function removeBotMention(text: string, botName?: string): string {
  // Remove @xxx patterns
  let cleaned = text.replace(/@\S+\s*/g, "").trim();

  // Remove bot name if provided
  if (botName) {
    cleaned = cleaned.replace(new RegExp(`^${escapeRegExp(botName)}[：:,，]?\\s*`, "i"), "").trim();
  }

  return cleaned;
}

/**
 * Escape special regex characters.
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
