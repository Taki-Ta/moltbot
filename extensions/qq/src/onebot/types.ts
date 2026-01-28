/**
 * OneBot v11 Protocol Types
 *
 * Reference: https://github.com/botuniverse/onebot-11
 */

// ============================================================================
// Message Segment Types (CQ码的结构化表示)
// ============================================================================

export interface TextSegment {
  type: "text";
  data: { text: string };
}

export interface FaceSegment {
  type: "face";
  data: { id: string };
}

export interface ImageSegment {
  type: "image";
  data: {
    file: string;
    url?: string;
    type?: "flash"; // 闪照
    subType?: number;
  };
}

export interface RecordSegment {
  type: "record";
  data: {
    file: string;
    url?: string;
    magic?: boolean; // 变声
  };
}

export interface VideoSegment {
  type: "video";
  data: {
    file: string;
    url?: string;
  };
}

export interface AtSegment {
  type: "at";
  data: { qq: string | "all" };
}

export interface ReplySegment {
  type: "reply";
  data: { id: string };
}

export interface ForwardSegment {
  type: "forward";
  data: { id: string };
}

export interface FileSegment {
  type: "file";
  data: {
    file: string;
    name?: string;
  };
}

export interface JsonSegment {
  type: "json";
  data: { data: string };
}

export interface PokeSegment {
  type: "poke";
  data: {
    type: string;
    id: string;
  };
}

export type OneBotMessageSegment =
  | TextSegment
  | FaceSegment
  | ImageSegment
  | RecordSegment
  | VideoSegment
  | AtSegment
  | ReplySegment
  | ForwardSegment
  | FileSegment
  | JsonSegment
  | PokeSegment;

// ============================================================================
// Event Types
// ============================================================================

export interface OneBotEventBase {
  time: number;
  self_id: number;
  post_type: string;
}

// Meta Event (心跳、生命周期)
export interface OneBotMetaEvent extends OneBotEventBase {
  post_type: "meta_event";
  meta_event_type: "lifecycle" | "heartbeat";
  sub_type?: "connect" | "enable" | "disable";
  status?: OneBotStatus;
  interval?: number;
}

// Message Event
export interface OneBotMessageEventBase extends OneBotEventBase {
  post_type: "message";
  message_type: "private" | "group";
  sub_type: string;
  message_id: number;
  user_id: number;
  message: OneBotMessageSegment[] | string;
  raw_message: string;
  font: number;
  sender: OneBotSender;
}

export interface OneBotPrivateMessageEvent extends OneBotMessageEventBase {
  message_type: "private";
  sub_type: "friend" | "group" | "other";
}

export interface OneBotGroupMessageEvent extends OneBotMessageEventBase {
  message_type: "group";
  sub_type: "normal" | "anonymous" | "notice";
  group_id: number;
  anonymous?: {
    id: number;
    name: string;
    flag: string;
  };
}

export type OneBotMessageEvent = OneBotPrivateMessageEvent | OneBotGroupMessageEvent;

// Notice Event (通知事件)
export interface OneBotNoticeEvent extends OneBotEventBase {
  post_type: "notice";
  notice_type: string;
  user_id?: number;
  group_id?: number;
}

// Request Event (请求事件)
export interface OneBotRequestEvent extends OneBotEventBase {
  post_type: "request";
  request_type: "friend" | "group";
  user_id: number;
  comment: string;
  flag: string;
  group_id?: number;
  sub_type?: "add" | "invite";
}

export type OneBotEvent =
  | OneBotMetaEvent
  | OneBotMessageEvent
  | OneBotNoticeEvent
  | OneBotRequestEvent;

// ============================================================================
// Sender Info
// ============================================================================

export interface OneBotSender {
  user_id: number;
  nickname: string;
  sex?: "male" | "female" | "unknown";
  age?: number;
  card?: string; // 群名片
  area?: string;
  level?: string;
  role?: "owner" | "admin" | "member";
  title?: string; // 专属头衔
}

// ============================================================================
// API Response Types
// ============================================================================

export interface OneBotApiResponse<T = unknown> {
  status: "ok" | "async" | "failed";
  retcode: number;
  data: T;
  message?: string;
  wording?: string;
  echo?: string;
}

// Send message response
export interface OneBotSendMsgResponse {
  message_id: number;
}

// Get login info response
export interface OneBotLoginInfo {
  user_id: number;
  nickname: string;
}

// Status info
export interface OneBotStatus {
  online: boolean;
  good: boolean;
}

// Version info
export interface OneBotVersionInfo {
  app_name: string;
  app_version: string;
  protocol_version: string;
}

// Friend info
export interface OneBotFriendInfo {
  user_id: number;
  nickname: string;
  remark: string;
}

// Group info
export interface OneBotGroupInfo {
  group_id: number;
  group_name: string;
  member_count: number;
  max_member_count: number;
}

// Group member info
export interface OneBotGroupMemberInfo {
  group_id: number;
  user_id: number;
  nickname: string;
  card: string;
  sex: "male" | "female" | "unknown";
  age: number;
  area: string;
  join_time: number;
  last_sent_time: number;
  level: string;
  role: "owner" | "admin" | "member";
  unfriendly: boolean;
  title: string;
  title_expire_time: number;
  card_changeable: boolean;
}

// Stranger info
export interface OneBotStrangerInfo {
  user_id: number;
  nickname: string;
  sex: "male" | "female" | "unknown";
  age: number;
}

// ============================================================================
// API Request Types
// ============================================================================

export interface OneBotApiRequest {
  action: string;
  params?: Record<string, unknown>;
  echo?: string;
}

// ============================================================================
// WebSocket Frame Types
// ============================================================================

export type OneBotWsFrame = OneBotEvent | OneBotApiResponse;

// Type guards
export function isOneBotEvent(frame: OneBotWsFrame): frame is OneBotEvent {
  return "post_type" in frame;
}

export function isOneBotApiResponse(frame: OneBotWsFrame): frame is OneBotApiResponse {
  return "status" in frame && "retcode" in frame;
}

export function isMessageEvent(event: OneBotEvent): event is OneBotMessageEvent {
  return event.post_type === "message";
}

export function isPrivateMessage(event: OneBotMessageEvent): event is OneBotPrivateMessageEvent {
  return event.message_type === "private";
}

export function isGroupMessage(event: OneBotMessageEvent): event is OneBotGroupMessageEvent {
  return event.message_type === "group";
}

export function isMetaEvent(event: OneBotEvent): event is OneBotMetaEvent {
  return event.post_type === "meta_event";
}
