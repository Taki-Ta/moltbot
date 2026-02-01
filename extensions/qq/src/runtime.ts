/**
 * QQ Channel Runtime Injection
 *
 * This module provides access to the plugin runtime, which is injected
 * during plugin registration. The runtime provides access to logging,
 * configuration, and other shared services.
 */

import type { PluginRuntime } from "openclaw/plugin-sdk";

let runtime: PluginRuntime | null = null;

/**
 * Set the QQ plugin runtime.
 * Called during plugin registration.
 */
export function setQQRuntime(next: PluginRuntime): void {
  runtime = next;
}

/**
 * Get the QQ plugin runtime.
 * Throws if the runtime has not been initialized.
 */
export function getQQRuntime(): PluginRuntime {
  if (!runtime) {
    throw new Error("QQ runtime not initialized. Ensure the plugin is properly registered.");
  }
  return runtime;
}

/**
 * Check if the QQ plugin runtime is initialized.
 */
export function hasQQRuntime(): boolean {
  return runtime !== null;
}
