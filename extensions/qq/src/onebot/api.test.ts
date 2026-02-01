/**
 * OneBot API Tests
 */

import { describe, expect, it, vi } from "vitest";
import { OneBotApi, textToSegments, atSegment, imageSegment, replySegment } from "./api.js";
import type { OneBotClient } from "./client.js";

// Create mock client
function createMockClient() {
  return {
    callApi: vi.fn(),
    isConnected: vi.fn().mockReturnValue(true),
  } as unknown as OneBotClient;
}

describe("OneBotApi", () => {
  describe("message helpers", () => {
    it("textToSegments converts string to text segment array", () => {
      const segments = textToSegments("Hello, World!");
      expect(segments).toEqual([{ type: "text", data: { text: "Hello, World!" } }]);
    });

    it("atSegment creates @mention segment", () => {
      expect(atSegment(12345)).toEqual({ type: "at", data: { qq: "12345" } });
      expect(atSegment("all")).toEqual({ type: "at", data: { qq: "all" } });
    });

    it("imageSegment creates image segment", () => {
      expect(imageSegment("file:///path/to/image.jpg")).toEqual({
        type: "image",
        data: { file: "file:///path/to/image.jpg" },
      });
    });

    it("replySegment creates reply segment", () => {
      expect(replySegment(12345)).toEqual({ type: "reply", data: { id: "12345" } });
      expect(replySegment("12345")).toEqual({ type: "reply", data: { id: "12345" } });
    });
  });

  describe("sendPrivateMsg", () => {
    it("sends private message with string", async () => {
      const client = createMockClient();
      const api = new OneBotApi(client);

      vi.mocked(client.callApi).mockResolvedValue({ message_id: 1 });

      const result = await api.sendPrivateMsg(12345, "Hello!");

      expect(client.callApi).toHaveBeenCalledWith("send_private_msg", {
        user_id: 12345,
        message: [{ type: "text", data: { text: "Hello!" } }],
      });
      expect(result).toEqual({ message_id: 1 });
    });

    it("sends private message with segments", async () => {
      const client = createMockClient();
      const api = new OneBotApi(client);

      vi.mocked(client.callApi).mockResolvedValue({ message_id: 2 });

      const segments = [
        { type: "text" as const, data: { text: "Hello " } },
        { type: "at" as const, data: { qq: "67890" } },
      ];
      await api.sendPrivateMsg(12345, segments);

      expect(client.callApi).toHaveBeenCalledWith("send_private_msg", {
        user_id: 12345,
        message: segments,
      });
    });
  });

  describe("sendGroupMsg", () => {
    it("sends group message", async () => {
      const client = createMockClient();
      const api = new OneBotApi(client);

      vi.mocked(client.callApi).mockResolvedValue({ message_id: 3 });

      const result = await api.sendGroupMsg(123456789, "Group message");

      expect(client.callApi).toHaveBeenCalledWith("send_group_msg", {
        group_id: 123456789,
        message: [{ type: "text", data: { text: "Group message" } }],
      });
      expect(result).toEqual({ message_id: 3 });
    });
  });

  describe("sendMsg", () => {
    it("sends message with auto-detect", async () => {
      const client = createMockClient();
      const api = new OneBotApi(client);

      vi.mocked(client.callApi).mockResolvedValue({ message_id: 4 });

      await api.sendMsg({
        messageType: "private",
        userId: 12345,
        message: "Auto message",
      });

      expect(client.callApi).toHaveBeenCalledWith("send_msg", {
        message_type: "private",
        user_id: 12345,
        group_id: undefined,
        message: [{ type: "text", data: { text: "Auto message" } }],
      });
    });
  });

  describe("deleteMsg", () => {
    it("deletes message", async () => {
      const client = createMockClient();
      const api = new OneBotApi(client);

      vi.mocked(client.callApi).mockResolvedValue(undefined);

      await api.deleteMsg(12345);

      expect(client.callApi).toHaveBeenCalledWith("delete_msg", {
        message_id: 12345,
      });
    });
  });

  describe("getLoginInfo", () => {
    it("gets login info", async () => {
      const client = createMockClient();
      const api = new OneBotApi(client);

      vi.mocked(client.callApi).mockResolvedValue({
        user_id: 12345,
        nickname: "TestBot",
      });

      const result = await api.getLoginInfo();

      expect(client.callApi).toHaveBeenCalledWith("get_login_info");
      expect(result).toEqual({ user_id: 12345, nickname: "TestBot" });
    });
  });

  describe("getFriendList", () => {
    it("gets friend list", async () => {
      const client = createMockClient();
      const api = new OneBotApi(client);

      const friends = [
        { user_id: 1, nickname: "Friend1", remark: "" },
        { user_id: 2, nickname: "Friend2", remark: "BestFriend" },
      ];
      vi.mocked(client.callApi).mockResolvedValue(friends);

      const result = await api.getFriendList();

      expect(client.callApi).toHaveBeenCalledWith("get_friend_list");
      expect(result).toEqual(friends);
    });
  });

  describe("getGroupList", () => {
    it("gets group list", async () => {
      const client = createMockClient();
      const api = new OneBotApi(client);

      const groups = [
        { group_id: 123, group_name: "Group1", member_count: 10, max_member_count: 200 },
        { group_id: 456, group_name: "Group2", member_count: 50, max_member_count: 500 },
      ];
      vi.mocked(client.callApi).mockResolvedValue(groups);

      const result = await api.getGroupList();

      expect(client.callApi).toHaveBeenCalledWith("get_group_list");
      expect(result).toEqual(groups);
    });
  });

  describe("getGroupInfo", () => {
    it("gets group info", async () => {
      const client = createMockClient();
      const api = new OneBotApi(client);

      const groupInfo = {
        group_id: 123,
        group_name: "TestGroup",
        member_count: 100,
        max_member_count: 500,
      };
      vi.mocked(client.callApi).mockResolvedValue(groupInfo);

      const result = await api.getGroupInfo(123);

      expect(client.callApi).toHaveBeenCalledWith("get_group_info", {
        group_id: 123,
        no_cache: false,
      });
      expect(result).toEqual(groupInfo);
    });

    it("gets group info with no_cache", async () => {
      const client = createMockClient();
      const api = new OneBotApi(client);

      vi.mocked(client.callApi).mockResolvedValue({});

      await api.getGroupInfo(123, true);

      expect(client.callApi).toHaveBeenCalledWith("get_group_info", {
        group_id: 123,
        no_cache: true,
      });
    });
  });

  describe("getGroupMemberList", () => {
    it("gets group member list", async () => {
      const client = createMockClient();
      const api = new OneBotApi(client);

      const members = [
        {
          group_id: 123,
          user_id: 1,
          nickname: "Member1",
          card: "",
          role: "member",
        },
      ];
      vi.mocked(client.callApi).mockResolvedValue(members);

      const result = await api.getGroupMemberList(123);

      expect(client.callApi).toHaveBeenCalledWith("get_group_member_list", {
        group_id: 123,
      });
      expect(result).toEqual(members);
    });
  });

  describe("group admin actions", () => {
    it("kicks member", async () => {
      const client = createMockClient();
      const api = new OneBotApi(client);

      vi.mocked(client.callApi).mockResolvedValue(undefined);

      await api.setGroupKick(123, 456);

      expect(client.callApi).toHaveBeenCalledWith("set_group_kick", {
        group_id: 123,
        user_id: 456,
        reject_add_request: false,
      });
    });

    it("bans member", async () => {
      const client = createMockClient();
      const api = new OneBotApi(client);

      vi.mocked(client.callApi).mockResolvedValue(undefined);

      await api.setGroupBan(123, 456, 3600);

      expect(client.callApi).toHaveBeenCalledWith("set_group_ban", {
        group_id: 123,
        user_id: 456,
        duration: 3600,
      });
    });

    it("sets group whole ban", async () => {
      const client = createMockClient();
      const api = new OneBotApi(client);

      vi.mocked(client.callApi).mockResolvedValue(undefined);

      await api.setGroupWholeBan(123, true);

      expect(client.callApi).toHaveBeenCalledWith("set_group_whole_ban", {
        group_id: 123,
        enable: true,
      });
    });

    it("sets group card", async () => {
      const client = createMockClient();
      const api = new OneBotApi(client);

      vi.mocked(client.callApi).mockResolvedValue(undefined);

      await api.setGroupCard(123, 456, "New Nickname");

      expect(client.callApi).toHaveBeenCalledWith("set_group_card", {
        group_id: 123,
        user_id: 456,
        card: "New Nickname",
      });
    });
  });

  describe("getStatus", () => {
    it("gets status", async () => {
      const client = createMockClient();
      const api = new OneBotApi(client);

      vi.mocked(client.callApi).mockResolvedValue({
        online: true,
        good: true,
      });

      const result = await api.getStatus();

      expect(client.callApi).toHaveBeenCalledWith("get_status");
      expect(result).toEqual({ online: true, good: true });
    });
  });

  describe("getVersionInfo", () => {
    it("gets version info", async () => {
      const client = createMockClient();
      const api = new OneBotApi(client);

      vi.mocked(client.callApi).mockResolvedValue({
        app_name: "NapCatQQ",
        app_version: "1.0.0",
        protocol_version: "v11",
      });

      const result = await api.getVersionInfo();

      expect(client.callApi).toHaveBeenCalledWith("get_version_info");
      expect(result).toEqual({
        app_name: "NapCatQQ",
        app_version: "1.0.0",
        protocol_version: "v11",
      });
    });
  });

  describe("canSendImage", () => {
    it("returns true when supported", async () => {
      const client = createMockClient();
      const api = new OneBotApi(client);

      vi.mocked(client.callApi).mockResolvedValue({ yes: true });

      const result = await api.canSendImage();

      expect(result).toBe(true);
    });

    it("returns false on error", async () => {
      const client = createMockClient();
      const api = new OneBotApi(client);

      vi.mocked(client.callApi).mockRejectedValue(new Error("Not supported"));

      const result = await api.canSendImage();

      expect(result).toBe(false);
    });
  });

  describe("setInputStatus", () => {
    it("sets typing status (text input)", async () => {
      const client = createMockClient();
      const api = new OneBotApi(client);

      vi.mocked(client.callApi).mockResolvedValue(undefined);

      await api.setInputStatus(12345, 1);

      expect(client.callApi).toHaveBeenCalledWith("set_input_status", {
        user_id: 12345,
        event_type: 1,
      });
    });

    it("sets normal status", async () => {
      const client = createMockClient();
      const api = new OneBotApi(client);

      vi.mocked(client.callApi).mockResolvedValue(undefined);

      await api.setInputStatus(12345, 2);

      expect(client.callApi).toHaveBeenCalledWith("set_input_status", {
        user_id: 12345,
        event_type: 2,
      });
    });

    it("defaults to text input (1)", async () => {
      const client = createMockClient();
      const api = new OneBotApi(client);

      vi.mocked(client.callApi).mockResolvedValue(undefined);

      await api.setInputStatus(12345);

      expect(client.callApi).toHaveBeenCalledWith("set_input_status", {
        user_id: 12345,
        event_type: 1,
      });
    });
  });
});
