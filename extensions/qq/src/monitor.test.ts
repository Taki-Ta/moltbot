/**
 * QQ Message Monitor Tests
 */

import { describe, expect, it, vi } from "vitest";
import type { OneBotMessageEvent, OneBotNoticeEvent } from "./onebot/types.js";
import {
  createMessageMonitor,
  extractMediaUrls,
  extractMentions,
  extractReplyId,
  extractTextFromSegments,
  isBotMentioned,
  isReplyTo,
  parseOneBotMessage,
  QQMessageMonitor,
  removeBotMention,
} from "./monitor.js";

// ============================================================================
// Test Fixtures
// ============================================================================

function createPrivateMessageEvent(
  overrides: Partial<OneBotMessageEvent> = {},
): OneBotMessageEvent {
  return {
    time: Math.floor(Date.now() / 1000),
    self_id: 100000,
    post_type: "message",
    message_type: "private",
    sub_type: "friend",
    message_id: 12345,
    user_id: 67890,
    message: [{ type: "text", data: { text: "Hello!" } }],
    raw_message: "Hello!",
    font: 0,
    sender: { user_id: 67890, nickname: "TestUser" },
    ...overrides,
  };
}

function createGroupMessageEvent(
  overrides: Partial<OneBotMessageEvent> = {},
): OneBotMessageEvent {
  return {
    time: Math.floor(Date.now() / 1000),
    self_id: 100000,
    post_type: "message",
    message_type: "group",
    sub_type: "normal",
    message_id: 54321,
    user_id: 67890,
    group_id: 123456789,
    message: [{ type: "text", data: { text: "Hi group!" } }],
    raw_message: "Hi group!",
    font: 0,
    sender: { user_id: 67890, nickname: "TestUser", card: "GroupNickname" },
    ...overrides,
  };
}

// ============================================================================
// Extraction Tests
// ============================================================================

describe("extractTextFromSegments", () => {
  it("extracts text from single segment", () => {
    const segments = [{ type: "text" as const, data: { text: "Hello" } }];
    expect(extractTextFromSegments(segments)).toBe("Hello");
  });

  it("concatenates multiple text segments", () => {
    const segments = [
      { type: "text" as const, data: { text: "Hello " } },
      { type: "text" as const, data: { text: "World" } },
    ];
    expect(extractTextFromSegments(segments)).toBe("Hello World");
  });

  it("ignores non-text segments", () => {
    const segments = [
      { type: "at" as const, data: { qq: "12345" } },
      { type: "text" as const, data: { text: "Hello" } },
      { type: "image" as const, data: { file: "xxx" } },
    ];
    expect(extractTextFromSegments(segments)).toBe("Hello");
  });

  it("returns empty string for no text segments", () => {
    const segments = [{ type: "image" as const, data: { file: "xxx" } }];
    expect(extractTextFromSegments(segments)).toBe("");
  });
});

describe("extractMediaUrls", () => {
  it("extracts image URLs", () => {
    const segments = [
      { type: "image" as const, data: { file: "xxx", url: "https://example.com/img.jpg" } },
    ];
    expect(extractMediaUrls(segments)).toEqual(["https://example.com/img.jpg"]);
  });

  it("extracts record URLs", () => {
    const segments = [
      { type: "record" as const, data: { file: "xxx", url: "https://example.com/voice.mp3" } },
    ];
    expect(extractMediaUrls(segments)).toEqual(["https://example.com/voice.mp3"]);
  });

  it("extracts video URLs", () => {
    const segments = [
      { type: "video" as const, data: { file: "xxx", url: "https://example.com/video.mp4" } },
    ];
    expect(extractMediaUrls(segments)).toEqual(["https://example.com/video.mp4"]);
  });

  it("extracts multiple media URLs", () => {
    const segments = [
      { type: "image" as const, data: { file: "xxx", url: "https://example.com/1.jpg" } },
      { type: "text" as const, data: { text: "Look at these!" } },
      { type: "image" as const, data: { file: "yyy", url: "https://example.com/2.jpg" } },
    ];
    expect(extractMediaUrls(segments)).toEqual([
      "https://example.com/1.jpg",
      "https://example.com/2.jpg",
    ]);
  });

  it("ignores segments without url", () => {
    const segments = [{ type: "image" as const, data: { file: "xxx" } }];
    expect(extractMediaUrls(segments)).toEqual([]);
  });
});

describe("extractMentions", () => {
  it("extracts single mention", () => {
    const segments = [{ type: "at" as const, data: { qq: "12345" } }];
    expect(extractMentions(segments)).toEqual(["12345"]);
  });

  it("extracts multiple mentions", () => {
    const segments = [
      { type: "at" as const, data: { qq: "12345" } },
      { type: "text" as const, data: { text: " " } },
      { type: "at" as const, data: { qq: "67890" } },
    ];
    expect(extractMentions(segments)).toEqual(["12345", "67890"]);
  });

  it("extracts @all mention", () => {
    const segments = [{ type: "at" as const, data: { qq: "all" } }];
    expect(extractMentions(segments)).toEqual(["all"]);
  });

  it("returns empty array for no mentions", () => {
    const segments = [{ type: "text" as const, data: { text: "Hello" } }];
    expect(extractMentions(segments)).toEqual([]);
  });
});

describe("extractReplyId", () => {
  it("extracts reply message ID", () => {
    const segments = [
      { type: "reply" as const, data: { id: "999" } },
      { type: "text" as const, data: { text: "Reply text" } },
    ];
    expect(extractReplyId(segments)).toBe("999");
  });

  it("returns undefined if no reply", () => {
    const segments = [{ type: "text" as const, data: { text: "Normal message" } }];
    expect(extractReplyId(segments)).toBeUndefined();
  });
});

// ============================================================================
// Message Parsing Tests
// ============================================================================

describe("parseOneBotMessage", () => {
  it("parses private message", () => {
    const event = createPrivateMessageEvent();
    const message = parseOneBotMessage(event);

    expect(message.chatType).toBe("private");
    expect(message.chatId).toBe("qq:67890");
    expect(message.senderId).toBe("67890");
    expect(message.senderName).toBe("TestUser");
    expect(message.text).toBe("Hello!");
    expect(message.rawMessage).toBe("Hello!");
    expect(message.messageId).toBe("12345");
  });

  it("parses group message", () => {
    const event = createGroupMessageEvent();
    const message = parseOneBotMessage(event);

    expect(message.chatType).toBe("group");
    expect(message.chatId).toBe("qq:group:123456789");
    expect(message.senderId).toBe("67890");
    expect(message.senderName).toBe("GroupNickname"); // Uses card over nickname
    expect(message.groupId).toBe(123456789);
  });

  it("uses nickname if card is empty", () => {
    const event = createGroupMessageEvent({
      sender: { user_id: 67890, nickname: "NickName", card: "" },
    });
    const message = parseOneBotMessage(event);

    expect(message.senderName).toBe("NickName");
  });

  it("parses message with media", () => {
    const event = createPrivateMessageEvent({
      message: [
        { type: "image", data: { file: "xxx", url: "https://example.com/img.jpg" } },
        { type: "text", data: { text: "Look at this!" } },
      ],
    });
    const message = parseOneBotMessage(event);

    expect(message.text).toBe("Look at this!");
    expect(message.mediaUrls).toEqual(["https://example.com/img.jpg"]);
  });

  it("parses message with mentions", () => {
    const event = createGroupMessageEvent({
      message: [
        { type: "at", data: { qq: "100000" } },
        { type: "text", data: { text: " Hello bot!" } },
      ],
    });
    const message = parseOneBotMessage(event);

    expect(message.mentions).toEqual(["100000"]);
    expect(message.text).toBe(" Hello bot!");
  });

  it("parses reply message", () => {
    const event = createPrivateMessageEvent({
      message: [
        { type: "reply", data: { id: "999" } },
        { type: "text", data: { text: "This is a reply" } },
      ],
    });
    const message = parseOneBotMessage(event);

    expect(message.replyToId).toBe("999");
  });

  it("converts timestamp to milliseconds", () => {
    const timestamp = 1700000000;
    const event = createPrivateMessageEvent({ time: timestamp });
    const message = parseOneBotMessage(event);

    expect(message.timestamp).toBe(timestamp * 1000);
  });
});

// ============================================================================
// Monitor Tests
// ============================================================================

describe("QQMessageMonitor", () => {
  it("processes message events", () => {
    const onMessage = vi.fn();
    const monitor = new QQMessageMonitor({ onMessage });

    const event = createPrivateMessageEvent();
    monitor.processEvent(event);

    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(onMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatType: "private",
        text: "Hello!",
      }),
    );
  });

  it("ignores non-message events", () => {
    const onMessage = vi.fn();
    const monitor = new QQMessageMonitor({ onMessage });

    const event: OneBotNoticeEvent = {
      time: Date.now(),
      self_id: 100000,
      post_type: "notice",
      notice_type: "group_increase",
      sub_type: "approve",
      group_id: 123456,
      operator_id: 0,
      user_id: 67890,
    };
    monitor.processEvent(event);

    expect(onMessage).not.toHaveBeenCalled();
  });

  it("filters private messages when disabled", () => {
    const onMessage = vi.fn();
    const monitor = new QQMessageMonitor({ onMessage, enablePrivate: false });

    monitor.processEvent(createPrivateMessageEvent());
    monitor.processEvent(createGroupMessageEvent());

    expect(onMessage).toHaveBeenCalledTimes(1);
  });

  it("filters group messages when disabled", () => {
    const onMessage = vi.fn();
    const monitor = new QQMessageMonitor({ onMessage, enableGroup: false });

    monitor.processEvent(createPrivateMessageEvent());
    monitor.processEvent(createGroupMessageEvent());

    expect(onMessage).toHaveBeenCalledTimes(1);
  });

  it("filters by allowed users", () => {
    const onMessage = vi.fn();
    const monitor = new QQMessageMonitor({
      onMessage,
      allowedUsers: [11111, 22222],
    });

    monitor.processEvent(createPrivateMessageEvent({ user_id: 11111 }));
    monitor.processEvent(createPrivateMessageEvent({ user_id: 33333 }));
    monitor.processEvent(createPrivateMessageEvent({ user_id: 22222 }));

    expect(onMessage).toHaveBeenCalledTimes(2);
  });

  it("filters by allowed groups", () => {
    const onMessage = vi.fn();
    const monitor = new QQMessageMonitor({
      onMessage,
      allowedGroups: [111111, 222222],
    });

    monitor.processEvent(createGroupMessageEvent({ group_id: 111111 }));
    monitor.processEvent(createGroupMessageEvent({ group_id: 333333 }));
    monitor.processEvent(createPrivateMessageEvent()); // Private messages not filtered by group

    expect(onMessage).toHaveBeenCalledTimes(2);
  });

  it("filters by blocked users", () => {
    const onMessage = vi.fn();
    const monitor = new QQMessageMonitor({
      onMessage,
      blockedUsers: [99999],
    });

    monitor.processEvent(createPrivateMessageEvent({ user_id: 11111 }));
    monitor.processEvent(createPrivateMessageEvent({ user_id: 99999 }));

    expect(onMessage).toHaveBeenCalledTimes(1);
  });

  it("filters by blocked groups", () => {
    const onMessage = vi.fn();
    const monitor = new QQMessageMonitor({
      onMessage,
      blockedGroups: [999999],
    });

    monitor.processEvent(createGroupMessageEvent({ group_id: 111111 }));
    monitor.processEvent(createGroupMessageEvent({ group_id: 999999 }));

    expect(onMessage).toHaveBeenCalledTimes(1);
  });

  it("calls onError for handler exceptions", () => {
    const onMessage = vi.fn().mockImplementation(() => {
      throw new Error("Handler error");
    });
    const onError = vi.fn();
    const monitor = new QQMessageMonitor({ onMessage, onError });

    monitor.processEvent(createPrivateMessageEvent());

    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });

  it("handles async handler errors", async () => {
    const onMessage = vi.fn().mockRejectedValue(new Error("Async error"));
    const onError = vi.fn();
    const monitor = new QQMessageMonitor({ onMessage, onError });

    monitor.processEvent(createPrivateMessageEvent());

    // Wait for async rejection
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });

  it("creates event handler function", () => {
    const onMessage = vi.fn();
    const monitor = new QQMessageMonitor({ onMessage });
    const handler = monitor.createEventHandler();

    handler(createPrivateMessageEvent());

    expect(onMessage).toHaveBeenCalledTimes(1);
  });
});

describe("createMessageMonitor", () => {
  it("creates monitor instance", () => {
    const monitor = createMessageMonitor({ onMessage: vi.fn() });
    expect(monitor).toBeInstanceOf(QQMessageMonitor);
  });
});

// ============================================================================
// Utility Function Tests
// ============================================================================

describe("isBotMentioned", () => {
  it("returns true when bot is mentioned", () => {
    const message = parseOneBotMessage(
      createGroupMessageEvent({
        message: [
          { type: "at", data: { qq: "100000" } },
          { type: "text", data: { text: " Hello" } },
        ],
      }),
    );

    expect(isBotMentioned(message, 100000)).toBe(true);
    expect(isBotMentioned(message, "100000")).toBe(true);
  });

  it("returns true when @all is used", () => {
    const message = parseOneBotMessage(
      createGroupMessageEvent({
        message: [
          { type: "at", data: { qq: "all" } },
          { type: "text", data: { text: " Everyone!" } },
        ],
      }),
    );

    expect(isBotMentioned(message, 100000)).toBe(true);
  });

  it("returns false when bot is not mentioned", () => {
    const message = parseOneBotMessage(
      createGroupMessageEvent({
        message: [
          { type: "at", data: { qq: "99999" } },
          { type: "text", data: { text: " Hello" } },
        ],
      }),
    );

    expect(isBotMentioned(message, 100000)).toBe(false);
  });

  it("returns false for messages without mentions", () => {
    const message = parseOneBotMessage(createPrivateMessageEvent());
    expect(isBotMentioned(message, 100000)).toBe(false);
  });
});

describe("isReplyTo", () => {
  it("returns true when message is reply to target", () => {
    const message = parseOneBotMessage(
      createPrivateMessageEvent({
        message: [
          { type: "reply", data: { id: "12345" } },
          { type: "text", data: { text: "Reply" } },
        ],
      }),
    );

    expect(isReplyTo(message, 12345)).toBe(true);
    expect(isReplyTo(message, "12345")).toBe(true);
  });

  it("returns false when message is not reply to target", () => {
    const message = parseOneBotMessage(
      createPrivateMessageEvent({
        message: [
          { type: "reply", data: { id: "99999" } },
          { type: "text", data: { text: "Reply" } },
        ],
      }),
    );

    expect(isReplyTo(message, 12345)).toBe(false);
  });

  it("returns false for non-reply messages", () => {
    const message = parseOneBotMessage(createPrivateMessageEvent());
    expect(isReplyTo(message, 12345)).toBe(false);
  });
});

describe("removeBotMention", () => {
  it("removes @mention patterns", () => {
    expect(removeBotMention("@Bot Hello there")).toBe("Hello there");
    expect(removeBotMention("@Bot @User Hello")).toBe("Hello");
  });

  it("removes bot name prefix", () => {
    expect(removeBotMention("Bot: Hello", "Bot")).toBe("Hello");
    expect(removeBotMention("Bot，请帮我", "Bot")).toBe("请帮我");
  });

  it("handles empty result", () => {
    expect(removeBotMention("@Bot ", "Bot")).toBe("");
  });

  it("preserves text without mentions", () => {
    expect(removeBotMention("Hello there")).toBe("Hello there");
  });
});
