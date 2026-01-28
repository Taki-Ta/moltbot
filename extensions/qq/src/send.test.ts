/**
 * QQ Message Sending Tests
 */

import { describe, expect, it, vi } from "vitest";
import type { OneBotApi } from "./onebot/api.js";
import {
  sendGroupImage,
  sendGroupText,
  sendPrivateImage,
  sendPrivateText,
  sendQQMediaMessage,
  sendQQRawMessage,
  sendQQTextMessage,
} from "./send.js";

// Mock API factory
function createMockApi(overrides: Partial<OneBotApi> = {}): OneBotApi {
  return {
    sendPrivateMsg: vi.fn().mockResolvedValue({ message_id: 100 }),
    sendGroupMsg: vi.fn().mockResolvedValue({ message_id: 200 }),
    ...overrides,
  } as unknown as OneBotApi;
}

describe("sendQQTextMessage", () => {
  it("sends text to private chat", async () => {
    const api = createMockApi();

    const result = await sendQQTextMessage(api, {
      target: "qq:12345",
      text: "Hello!",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.messageId).toBe("100");
      expect(result.chatId).toBe("qq:12345");
    }
    expect(api.sendPrivateMsg).toHaveBeenCalledWith(12345, [
      { type: "text", data: { text: "Hello!" } },
    ]);
  });

  it("sends text to group chat", async () => {
    const api = createMockApi();

    const result = await sendQQTextMessage(api, {
      target: "qq:group:67890",
      text: "Hello group!",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.messageId).toBe("200");
      expect(result.chatId).toBe("qq:group:67890");
    }
    expect(api.sendGroupMsg).toHaveBeenCalledWith(67890, [
      { type: "text", data: { text: "Hello group!" } },
    ]);
  });

  it("includes reply segment when replyToMessageId is provided", async () => {
    const api = createMockApi();

    await sendQQTextMessage(api, {
      target: "qq:12345",
      text: "Reply message",
      replyToMessageId: 999,
    });

    expect(api.sendPrivateMsg).toHaveBeenCalledWith(12345, [
      { type: "reply", data: { id: "999" } },
      { type: "text", data: { text: "Reply message" } },
    ]);
  });

  it("returns error for invalid target", async () => {
    const api = createMockApi();

    const result = await sendQQTextMessage(api, {
      target: "invalid",
      text: "Hello",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Invalid target");
    }
  });

  it("returns error when API call fails", async () => {
    const api = createMockApi({
      sendPrivateMsg: vi.fn().mockRejectedValue(new Error("Network error")),
    });

    const result = await sendQQTextMessage(api, {
      target: "qq:12345",
      text: "Hello",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Network error");
    }
  });
});

describe("sendQQMediaMessage", () => {
  it("sends image to private chat", async () => {
    const api = createMockApi();

    const result = await sendQQMediaMessage(api, {
      target: "qq:12345",
      mediaType: "image",
      file: "https://example.com/image.jpg",
    });

    expect(result.ok).toBe(true);
    expect(api.sendPrivateMsg).toHaveBeenCalledWith(12345, [
      { type: "image", data: { file: "https://example.com/image.jpg" } },
    ]);
  });

  it("sends image with caption", async () => {
    const api = createMockApi();

    await sendQQMediaMessage(api, {
      target: "qq:12345",
      mediaType: "image",
      file: "https://example.com/image.jpg",
      caption: "Look at this!",
    });

    expect(api.sendPrivateMsg).toHaveBeenCalledWith(12345, [
      { type: "image", data: { file: "https://example.com/image.jpg" } },
      { type: "text", data: { text: "Look at this!" } },
    ]);
  });

  it("sends voice message", async () => {
    const api = createMockApi();

    await sendQQMediaMessage(api, {
      target: "qq:12345",
      mediaType: "voice",
      file: "https://example.com/voice.mp3",
    });

    expect(api.sendPrivateMsg).toHaveBeenCalledWith(12345, [
      { type: "record", data: { file: "https://example.com/voice.mp3" } },
    ]);
  });

  it("sends video message", async () => {
    const api = createMockApi();

    await sendQQMediaMessage(api, {
      target: "qq:group:67890",
      mediaType: "video",
      file: "https://example.com/video.mp4",
    });

    expect(api.sendGroupMsg).toHaveBeenCalledWith(67890, [
      { type: "video", data: { file: "https://example.com/video.mp4" } },
    ]);
  });

  it("handles file type with fallback text", async () => {
    const api = createMockApi();

    await sendQQMediaMessage(api, {
      target: "qq:12345",
      mediaType: "file",
      file: "https://example.com/doc.pdf",
    });

    expect(api.sendPrivateMsg).toHaveBeenCalledWith(12345, [
      { type: "text", data: { text: "[文件] https://example.com/doc.pdf" } },
    ]);
  });

  it("includes reply segment when replyToMessageId is provided", async () => {
    const api = createMockApi();

    await sendQQMediaMessage(api, {
      target: "qq:12345",
      mediaType: "image",
      file: "https://example.com/image.jpg",
      replyToMessageId: 888,
    });

    expect(api.sendPrivateMsg).toHaveBeenCalledWith(12345, [
      { type: "reply", data: { id: "888" } },
      { type: "image", data: { file: "https://example.com/image.jpg" } },
    ]);
  });

  it("returns error for invalid target", async () => {
    const api = createMockApi();

    const result = await sendQQMediaMessage(api, {
      target: "bad:target",
      mediaType: "image",
      file: "https://example.com/image.jpg",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Invalid target");
    }
  });
});

describe("sendQQRawMessage", () => {
  it("sends raw segments to private chat", async () => {
    const api = createMockApi();

    const segments = [
      { type: "at" as const, data: { qq: "all" } },
      { type: "text" as const, data: { text: "Attention everyone!" } },
    ];

    const result = await sendQQRawMessage(api, "qq:12345", segments);

    expect(result.ok).toBe(true);
    expect(api.sendPrivateMsg).toHaveBeenCalledWith(12345, segments);
  });

  it("sends raw segments to group chat", async () => {
    const api = createMockApi();

    const segments = [{ type: "text" as const, data: { text: "Test" } }];

    const result = await sendQQRawMessage(api, "qq:group:67890", segments);

    expect(result.ok).toBe(true);
    expect(api.sendGroupMsg).toHaveBeenCalledWith(67890, segments);
  });

  it("returns error for invalid target", async () => {
    const api = createMockApi();

    const result = await sendQQRawMessage(api, "12345", []);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Invalid target");
    }
  });
});

describe("convenience functions", () => {
  describe("sendPrivateText", () => {
    it("sends text to user", async () => {
      const api = createMockApi();

      const result = await sendPrivateText(api, 12345, "Hello user!");

      expect(result.ok).toBe(true);
      expect(api.sendPrivateMsg).toHaveBeenCalledWith(12345, [
        { type: "text", data: { text: "Hello user!" } },
      ]);
    });

    it("supports reply", async () => {
      const api = createMockApi();

      await sendPrivateText(api, 12345, "Reply", 999);

      expect(api.sendPrivateMsg).toHaveBeenCalledWith(12345, [
        { type: "reply", data: { id: "999" } },
        { type: "text", data: { text: "Reply" } },
      ]);
    });
  });

  describe("sendGroupText", () => {
    it("sends text to group", async () => {
      const api = createMockApi();

      const result = await sendGroupText(api, 67890, "Hello group!");

      expect(result.ok).toBe(true);
      expect(api.sendGroupMsg).toHaveBeenCalledWith(67890, [
        { type: "text", data: { text: "Hello group!" } },
      ]);
    });
  });

  describe("sendPrivateImage", () => {
    it("sends image to user", async () => {
      const api = createMockApi();

      const result = await sendPrivateImage(
        api,
        12345,
        "https://example.com/img.jpg",
        "Check this out!",
      );

      expect(result.ok).toBe(true);
      expect(api.sendPrivateMsg).toHaveBeenCalledWith(12345, [
        { type: "image", data: { file: "https://example.com/img.jpg" } },
        { type: "text", data: { text: "Check this out!" } },
      ]);
    });
  });

  describe("sendGroupImage", () => {
    it("sends image to group", async () => {
      const api = createMockApi();

      const result = await sendGroupImage(api, 67890, "https://example.com/img.jpg");

      expect(result.ok).toBe(true);
      expect(api.sendGroupMsg).toHaveBeenCalledWith(67890, [
        { type: "image", data: { file: "https://example.com/img.jpg" } },
      ]);
    });
  });
});
