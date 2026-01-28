/**
 * QQ Connection Test Script
 *
 * Tests connection to NapCat OneBot WebSocket server.
 * Run with: npx tsx extensions/qq/test-connection.ts
 */

import WebSocket from "ws";

const WS_URL = "ws://127.0.0.1:3001";

console.log(`\n🔌 Connecting to NapCat at ${WS_URL}...\n`);

const ws = new WebSocket(WS_URL);

ws.on("open", () => {
  console.log("✅ Connected to NapCat!\n");

  // Request login info
  const request = {
    action: "get_login_info",
    params: {},
    echo: "test_login_info"
  };

  console.log("📤 Sending get_login_info request...");
  ws.send(JSON.stringify(request));
});

ws.on("message", (data) => {
  try {
    const message = JSON.parse(data.toString());

    // Check if it's our API response
    if (message.echo === "test_login_info") {
      if (message.status === "ok") {
        console.log("\n✅ Login info received:");
        console.log(`   QQ号: ${message.data.user_id}`);
        console.log(`   昵称: ${message.data.nickname}`);
      } else {
        console.log("\n❌ API call failed:", message.message || message.wording);
      }

      // Close connection after getting info
      setTimeout(() => {
        console.log("\n👋 Closing connection...");
        ws.close();
      }, 500);
      return;
    }

    // It's an event
    if (message.post_type === "message") {
      const chatType = message.message_type === "group" ? "群聊" : "私聊";
      const sender = message.sender?.nickname || message.user_id;
      console.log(`\n📨 收到${chatType}消息 [${sender}]: ${message.raw_message?.slice(0, 50)}...`);
    } else if (message.post_type === "meta_event" && message.meta_event_type === "heartbeat") {
      console.log("💓 Heartbeat");
    } else if (message.post_type === "meta_event" && message.meta_event_type === "lifecycle") {
      console.log(`🔄 Lifecycle event: ${message.sub_type}`);
    }
  } catch (err) {
    console.log("⚠️ Failed to parse message:", data.toString().slice(0, 100));
  }
});

ws.on("error", (error) => {
  console.error("\n❌ Connection error:", error.message);
  console.log("\n提示: 请确保 NapCat 已启动且 WebSocket 服务器已配置在端口 3001");
  process.exit(1);
});

ws.on("close", (code, reason) => {
  console.log(`\n🔌 Connection closed (code: ${code})`);
  process.exit(0);
});

// Timeout after 10 seconds
setTimeout(() => {
  console.log("\n⏱️ Timeout - closing connection");
  ws.close();
}, 10000);
