/**
 * QQ Message Sending Module
 *
 * Handles sending text and media messages via OneBot API.
 */

import type { OneBotApi } from "./onebot/api.js";
import type { OneBotMessageSegment, OneBotSendMsgResponse } from "./onebot/types.js";
import { formatQQTarget, parseQQTarget, type ParsedQQTarget } from "./normalize.js";
import type { QQSendResponse } from "./types.js";

// ============================================================================
// Types
// ============================================================================

export interface SendMessageOptions {
  /** Target ID (normalized format: qq:12345 or qq:group:12345) */
  target: string;
  /** Optional message ID to reply to */
  replyToMessageId?: number;
}

export interface SendTextMessageOptions extends SendMessageOptions {
  /** Text content to send */
  text: string;
}

export interface SendMediaMessageOptions extends SendMessageOptions {
  /** Media type */
  mediaType: "image" | "voice" | "video" | "file";
  /** File URL or path */
  file: string;
  /** Optional caption for the media */
  caption?: string;
}

// ============================================================================
// Message Building
// ============================================================================

/**
 * Build message segments for text message.
 */
function buildTextSegments(
  text: string,
  replyToMessageId?: number,
): OneBotMessageSegment[] {
  const segments: OneBotMessageSegment[] = [];

  if (replyToMessageId !== undefined) {
    segments.push({ type: "reply", data: { id: String(replyToMessageId) } });
  }

  segments.push({ type: "text", data: { text } });

  return segments;
}

/**
 * Build message segments for media message.
 */
function buildMediaSegments(
  mediaType: "image" | "voice" | "video" | "file",
  file: string,
  caption?: string,
  replyToMessageId?: number,
): OneBotMessageSegment[] {
  const segments: OneBotMessageSegment[] = [];

  if (replyToMessageId !== undefined) {
    segments.push({ type: "reply", data: { id: String(replyToMessageId) } });
  }

  // Add media segment based on type
  switch (mediaType) {
    case "image":
      segments.push({ type: "image", data: { file } });
      break;
    case "voice":
      segments.push({ type: "record", data: { file } });
      break;
    case "video":
      segments.push({ type: "video", data: { file } });
      break;
    case "file":
      // File sharing is not in standard OneBot v11, but some implementations support it
      // Fall back to text with file link
      segments.push({ type: "text", data: { text: `[文件] ${file}` } });
      break;
  }

  // Add caption as separate text segment if provided
  if (caption) {
    segments.push({ type: "text", data: { text: caption } });
  }

  return segments;
}

// ============================================================================
// Send Functions
// ============================================================================

/**
 * Send a message to a target.
 */
async function sendMessage(
  api: OneBotApi,
  target: ParsedQQTarget,
  segments: OneBotMessageSegment[],
): Promise<OneBotSendMsgResponse> {
  if (target.type === "group") {
    return api.sendGroupMsg(target.id, segments);
  }
  return api.sendPrivateMsg(target.id, segments);
}

/**
 * Send a text message to a QQ target.
 */
export async function sendQQTextMessage(
  api: OneBotApi,
  options: SendTextMessageOptions,
): Promise<QQSendResponse> {
  const target = parseQQTarget(options.target);
  if (!target) {
    return {
      ok: false,
      error: `Invalid target: ${options.target}`,
    };
  }

  try {
    const segments = buildTextSegments(options.text, options.replyToMessageId);
    const response = await sendMessage(api, target, segments);

    return {
      ok: true,
      messageId: String(response.message_id),
      chatId: formatQQTarget(target),
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Send a media message to a QQ target.
 */
export async function sendQQMediaMessage(
  api: OneBotApi,
  options: SendMediaMessageOptions,
): Promise<QQSendResponse> {
  const target = parseQQTarget(options.target);
  if (!target) {
    return {
      ok: false,
      error: `Invalid target: ${options.target}`,
    };
  }

  try {
    const segments = buildMediaSegments(
      options.mediaType,
      options.file,
      options.caption,
      options.replyToMessageId,
    );
    const response = await sendMessage(api, target, segments);

    return {
      ok: true,
      messageId: String(response.message_id),
      chatId: formatQQTarget(target),
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Send raw message segments to a QQ target.
 */
export async function sendQQRawMessage(
  api: OneBotApi,
  target: string,
  segments: OneBotMessageSegment[],
): Promise<QQSendResponse> {
  const parsedTarget = parseQQTarget(target);
  if (!parsedTarget) {
    return {
      ok: false,
      error: `Invalid target: ${target}`,
    };
  }

  try {
    const response = await sendMessage(api, parsedTarget, segments);

    return {
      ok: true,
      messageId: String(response.message_id),
      chatId: formatQQTarget(parsedTarget),
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Send a text message to a private chat.
 */
export async function sendPrivateText(
  api: OneBotApi,
  userId: number,
  text: string,
  replyToMessageId?: number,
): Promise<QQSendResponse> {
  return sendQQTextMessage(api, {
    target: `qq:${userId}`,
    text,
    replyToMessageId,
  });
}

/**
 * Send a text message to a group chat.
 */
export async function sendGroupText(
  api: OneBotApi,
  groupId: number,
  text: string,
  replyToMessageId?: number,
): Promise<QQSendResponse> {
  return sendQQTextMessage(api, {
    target: `qq:group:${groupId}`,
    text,
    replyToMessageId,
  });
}

/**
 * Send an image to a private chat.
 */
export async function sendPrivateImage(
  api: OneBotApi,
  userId: number,
  file: string,
  caption?: string,
): Promise<QQSendResponse> {
  return sendQQMediaMessage(api, {
    target: `qq:${userId}`,
    mediaType: "image",
    file,
    caption,
  });
}

/**
 * Send an image to a group chat.
 */
export async function sendGroupImage(
  api: OneBotApi,
  groupId: number,
  file: string,
  caption?: string,
): Promise<QQSendResponse> {
  return sendQQMediaMessage(api, {
    target: `qq:group:${groupId}`,
    mediaType: "image",
    file,
    caption,
  });
}
