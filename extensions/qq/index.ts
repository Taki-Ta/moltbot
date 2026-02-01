/**
 * QQ Channel Plugin Entry Point
 *
 * This plugin provides QQ messaging support via NapCatQQ/OneBot v11 protocol.
 */

import type { MoltbotPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";

import { qqPlugin } from "./src/channel.js";
import { setQQRuntime } from "./src/runtime.js";

const plugin = {
  id: "qq",
  name: "QQ",
  description: "QQ channel plugin (via NapCatQQ/OneBot v11)",
  configSchema: emptyPluginConfigSchema(),

  register(api: MoltbotPluginApi): void {
    // Inject runtime for access to logging, config, etc.
    setQQRuntime(api.runtime);

    // Register the channel plugin
    api.registerChannel({ plugin: qqPlugin });
  },
};

export default plugin;
