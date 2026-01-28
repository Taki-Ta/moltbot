/**
 * OneBot v11 API Wrapper
 *
 * High-level API functions built on top of OneBotClient.
 * Reference: https://github.com/botuniverse/onebot-11/blob/master/api/public.md
 */

import type { OneBotClient } from "./client.js";
import type {
  OneBotFriendInfo,
  OneBotGroupInfo,
  OneBotGroupMemberInfo,
  OneBotLoginInfo,
  OneBotMessageSegment,
  OneBotSendMsgResponse,
  OneBotStatus,
  OneBotStrangerInfo,
  OneBotVersionInfo,
} from "./types.js";

// ============================================================================
// Message Helpers
// ============================================================================

/**
 * Convert text to message segments.
 */
export function textToSegments(text: string): OneBotMessageSegment[] {
  return [{ type: "text", data: { text } }];
}

/**
 * Create an @mention segment.
 */
export function atSegment(qq: string | number | "all"): OneBotMessageSegment {
  return { type: "at", data: { qq: String(qq) } };
}

/**
 * Create an image segment.
 */
export function imageSegment(file: string): OneBotMessageSegment {
  return { type: "image", data: { file } };
}

/**
 * Create a reply segment.
 */
export function replySegment(messageId: string | number): OneBotMessageSegment {
  return { type: "reply", data: { id: String(messageId) } };
}

// ============================================================================
// API Class
// ============================================================================

export class OneBotApi {
  constructor(private client: OneBotClient) {}

  // ==========================================================================
  // Message APIs
  // ==========================================================================

  /**
   * Send a private message.
   */
  async sendPrivateMsg(
    userId: number,
    message: string | OneBotMessageSegment[],
  ): Promise<OneBotSendMsgResponse> {
    const messageData = typeof message === "string" ? textToSegments(message) : message;
    return this.client.callApi<OneBotSendMsgResponse>("send_private_msg", {
      user_id: userId,
      message: messageData,
    });
  }

  /**
   * Send a group message.
   */
  async sendGroupMsg(
    groupId: number,
    message: string | OneBotMessageSegment[],
  ): Promise<OneBotSendMsgResponse> {
    const messageData = typeof message === "string" ? textToSegments(message) : message;
    return this.client.callApi<OneBotSendMsgResponse>("send_group_msg", {
      group_id: groupId,
      message: messageData,
    });
  }

  /**
   * Send a message (auto-detect type based on params).
   */
  async sendMsg(params: {
    messageType?: "private" | "group";
    userId?: number;
    groupId?: number;
    message: string | OneBotMessageSegment[];
  }): Promise<OneBotSendMsgResponse> {
    const messageData =
      typeof params.message === "string" ? textToSegments(params.message) : params.message;

    return this.client.callApi<OneBotSendMsgResponse>("send_msg", {
      message_type: params.messageType,
      user_id: params.userId,
      group_id: params.groupId,
      message: messageData,
    });
  }

  /**
   * Recall/delete a message.
   */
  async deleteMsg(messageId: number): Promise<void> {
    await this.client.callApi("delete_msg", { message_id: messageId });
  }

  /**
   * Get message details by ID.
   */
  async getMsg(messageId: number): Promise<{
    message_id: number;
    real_id: number;
    sender: { user_id: number; nickname: string };
    time: number;
    message: OneBotMessageSegment[];
    raw_message: string;
  }> {
    return this.client.callApi("get_msg", { message_id: messageId });
  }

  // ==========================================================================
  // User/Friend APIs
  // ==========================================================================

  /**
   * Get bot's login info.
   */
  async getLoginInfo(): Promise<OneBotLoginInfo> {
    return this.client.callApi<OneBotLoginInfo>("get_login_info");
  }

  /**
   * Get stranger info.
   */
  async getStrangerInfo(userId: number, noCache = false): Promise<OneBotStrangerInfo> {
    return this.client.callApi<OneBotStrangerInfo>("get_stranger_info", {
      user_id: userId,
      no_cache: noCache,
    });
  }

  /**
   * Get friend list.
   */
  async getFriendList(): Promise<OneBotFriendInfo[]> {
    return this.client.callApi<OneBotFriendInfo[]>("get_friend_list");
  }

  // ==========================================================================
  // Group APIs
  // ==========================================================================

  /**
   * Get group list.
   */
  async getGroupList(): Promise<OneBotGroupInfo[]> {
    return this.client.callApi<OneBotGroupInfo[]>("get_group_list");
  }

  /**
   * Get group info.
   */
  async getGroupInfo(groupId: number, noCache = false): Promise<OneBotGroupInfo> {
    return this.client.callApi<OneBotGroupInfo>("get_group_info", {
      group_id: groupId,
      no_cache: noCache,
    });
  }

  /**
   * Get group member list.
   */
  async getGroupMemberList(groupId: number): Promise<OneBotGroupMemberInfo[]> {
    return this.client.callApi<OneBotGroupMemberInfo[]>("get_group_member_list", {
      group_id: groupId,
    });
  }

  /**
   * Get group member info.
   */
  async getGroupMemberInfo(
    groupId: number,
    userId: number,
    noCache = false,
  ): Promise<OneBotGroupMemberInfo> {
    return this.client.callApi<OneBotGroupMemberInfo>("get_group_member_info", {
      group_id: groupId,
      user_id: userId,
      no_cache: noCache,
    });
  }

  // ==========================================================================
  // Group Admin APIs
  // ==========================================================================

  /**
   * Set group kick (remove member from group).
   */
  async setGroupKick(groupId: number, userId: number, rejectAddRequest = false): Promise<void> {
    await this.client.callApi("set_group_kick", {
      group_id: groupId,
      user_id: userId,
      reject_add_request: rejectAddRequest,
    });
  }

  /**
   * Set group ban (mute member).
   * @param duration Ban duration in seconds (0 = unban)
   */
  async setGroupBan(groupId: number, userId: number, duration = 1800): Promise<void> {
    await this.client.callApi("set_group_ban", {
      group_id: groupId,
      user_id: userId,
      duration,
    });
  }

  /**
   * Set group whole ban (mute all members).
   */
  async setGroupWholeBan(groupId: number, enable = true): Promise<void> {
    await this.client.callApi("set_group_whole_ban", {
      group_id: groupId,
      enable,
    });
  }

  /**
   * Set group admin.
   */
  async setGroupAdmin(groupId: number, userId: number, enable = true): Promise<void> {
    await this.client.callApi("set_group_admin", {
      group_id: groupId,
      user_id: userId,
      enable,
    });
  }

  /**
   * Set group card (nickname in group).
   */
  async setGroupCard(groupId: number, userId: number, card: string): Promise<void> {
    await this.client.callApi("set_group_card", {
      group_id: groupId,
      user_id: userId,
      card,
    });
  }

  /**
   * Set group name.
   */
  async setGroupName(groupId: number, groupName: string): Promise<void> {
    await this.client.callApi("set_group_name", {
      group_id: groupId,
      group_name: groupName,
    });
  }

  /**
   * Leave group.
   */
  async setGroupLeave(groupId: number, isDismiss = false): Promise<void> {
    await this.client.callApi("set_group_leave", {
      group_id: groupId,
      is_dismiss: isDismiss,
    });
  }

  // ==========================================================================
  // Request Handling APIs
  // ==========================================================================

  /**
   * Handle friend add request.
   */
  async setFriendAddRequest(flag: string, approve = true, remark?: string): Promise<void> {
    await this.client.callApi("set_friend_add_request", {
      flag,
      approve,
      remark,
    });
  }

  /**
   * Handle group add request.
   */
  async setGroupAddRequest(
    flag: string,
    subType: "add" | "invite",
    approve = true,
    reason?: string,
  ): Promise<void> {
    await this.client.callApi("set_group_add_request", {
      flag,
      sub_type: subType,
      approve,
      reason,
    });
  }

  // ==========================================================================
  // System APIs
  // ==========================================================================

  /**
   * Get status info.
   */
  async getStatus(): Promise<OneBotStatus> {
    return this.client.callApi<OneBotStatus>("get_status");
  }

  /**
   * Get version info.
   */
  async getVersionInfo(): Promise<OneBotVersionInfo> {
    return this.client.callApi<OneBotVersionInfo>("get_version_info");
  }

  /**
   * Check if OneBot implementation supports quick operation.
   */
  async canSendImage(): Promise<boolean> {
    try {
      const result = await this.client.callApi<{ yes: boolean }>("can_send_image");
      return result.yes;
    } catch {
      return false;
    }
  }

  /**
   * Check if OneBot implementation supports record (voice) messages.
   */
  async canSendRecord(): Promise<boolean> {
    try {
      const result = await this.client.callApi<{ yes: boolean }>("can_send_record");
      return result.yes;
    } catch {
      return false;
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create an API wrapper for the given client.
 */
export function createOneBotApi(client: OneBotClient): OneBotApi {
  return new OneBotApi(client);
}
