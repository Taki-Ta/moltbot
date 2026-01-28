/**
 * QQ Send Message Test
 *
 * Tests sending a message via OneBot API.
 * Usage: npx tsx extensions/qq/test-send.ts <target> <message>
 *
 * Examples:
 *   npx tsx extensions/qq/test-send.ts 123456789 "Hello!"
 *   npx tsx extensions/qq/test-send.ts group:740112783 "Hello group!"
 */

import WebSocket from "ws";

const WS_URL = "ws://127.0.0.1:3001";

// Parse arguments
const args = process.argv.slice(2);
if (args.length < 2) {
  console.log("Usage: npx tsx extensions/qq/test-send.ts <target> <message>");
  console.log("");
  console.log("Examples:");
  console.log('  npx tsx extensions/qq/test-send.ts 123456789 "Hello!"');
  console.log('  npx tsx extensions/qq/test-send.ts group:740112783 "Hello group!"');
  process.exit(1);
}

const [target, ...messageParts] = args;
const message = messageParts.join(" ");

// Parse target
const isGroup = target.startsWith("group:");
const targetId = isGroup ? Number(target.slice(6)) : Number(target);

if (Number.isNaN(targetId)) {
  console.error("❌ Invalid target ID:", target);
  process.exit(1);
}

console.log(`\n🔌 Connecting to NapCat at ${WS_URL}...`);

const ws = new WebSocket(WS_URL);

ws.on("open", () => {
  console.log("✅ Connected!\n");

  const action = isGroup ? "send_group_msg" : "send_private_msg";
  const params = isGroup
    ? { group_id: targetId, message: [{ type: "text", data: { text: message } }] }
    : { user_id: targetId, message: [{ type: "text", data: { text: message } }] };

  const request = {
    action,
    params,
    echo: "test_send"
  };

  console.log(`📤 Sending ${isGroup ? "group" : "private"} message to ${targetId}...`);
  console.log(`   Content: "${message}"`);
  ws.send(JSON.stringify(request));
});

ws.on("message", (data) => {
  try {
    const response = JSON.parse(data.toString());

    if (response.echo === "test_send") {
      if (response.status === "ok") {
        console.log(`\n✅ Message sent successfully!`);
        console.log(`   Message ID: ${response.data?.message_id}`);
      } else {
        console.log(`\n❌ Failed to send message:`);
        console.log(`   Error: ${response.message || response.wording || "Unknown error"}`);
        console.log(`   Retcode: ${response.retcode}`);
      }

      setTimeout(() => {
        ws.close();
      }, 500);
    }
  } catch {
    // Ignore parse errors
  }
});

ws.on("error", (error) => {
  console.error("\n❌ Connection error:", error.message);
  process.exit(1);
});

ws.on("close", () => {
  console.log("\n👋 Done!");
  process.exit(0);
});

setTimeout(() => {
  console.log("\n⏱️ Timeout");
  ws.close();
}, 10000);
