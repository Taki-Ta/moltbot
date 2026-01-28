/**
 * QQ Target ID Normalization
 *
 * Handles normalization and validation of QQ user IDs and group IDs.
 *
 * Target ID formats:
 * - Private: "qq:12345" or "12345" (QQ号)
 * - Group: "qq:group:12345" or "group:12345" (群号)
 */

// ============================================================================
// Constants
// ============================================================================

const QQ_PREFIX = "qq:";
const GROUP_PREFIX = "group:";
const QQ_GROUP_PREFIX = "qq:group:";

// QQ号范围: 5-11位数字
const QQ_ID_PATTERN = /^\d{5,11}$/;

// ============================================================================
// Normalization
// ============================================================================

/**
 * Normalize a QQ messaging target.
 *
 * Accepts:
 * - "12345" -> "qq:12345" (private)
 * - "qq:12345" -> "qq:12345" (private)
 * - "group:12345" -> "qq:group:12345" (group)
 * - "qq:group:12345" -> "qq:group:12345" (group)
 *
 * @returns Normalized target ID or undefined if invalid
 */
export function normalizeQQMessagingTarget(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;

  let normalized = trimmed;

  // Remove qq: prefix if present
  if (normalized.toLowerCase().startsWith(QQ_PREFIX)) {
    normalized = normalized.slice(QQ_PREFIX.length);
  }

  // Check for group prefix
  const isGroup = normalized.toLowerCase().startsWith(GROUP_PREFIX);
  if (isGroup) {
    normalized = normalized.slice(GROUP_PREFIX.length);
  }

  // Validate the ID is a valid QQ number
  if (!QQ_ID_PATTERN.test(normalized)) {
    return undefined;
  }

  // Return normalized format
  if (isGroup) {
    return `${QQ_GROUP_PREFIX}${normalized}`;
  }
  return `${QQ_PREFIX}${normalized}`;
}

/**
 * Check if a string looks like a QQ target ID.
 *
 * Returns true for:
 * - "12345" (5-11 digit number)
 * - "qq:12345"
 * - "group:12345"
 * - "qq:group:12345"
 */
export function looksLikeQQTargetId(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;

  // Check for qq: or group: prefix
  if (/^qq:/i.test(trimmed)) return true;
  if (/^group:/i.test(trimmed)) return true;

  // Check if it's a valid QQ number (5-11 digits)
  return QQ_ID_PATTERN.test(trimmed);
}

// ============================================================================
// Parsing
// ============================================================================

export interface ParsedQQTarget {
  type: "private" | "group";
  id: number;
}

/**
 * Parse a normalized QQ target ID.
 *
 * @param normalized - A normalized target ID (from normalizeQQMessagingTarget)
 * @returns Parsed target or undefined if invalid
 */
export function parseQQTarget(normalized: string): ParsedQQTarget | undefined {
  if (!normalized) return undefined;

  // Group target: qq:group:12345
  if (normalized.startsWith(QQ_GROUP_PREFIX)) {
    const idStr = normalized.slice(QQ_GROUP_PREFIX.length);
    const id = Number.parseInt(idStr, 10);
    if (!Number.isFinite(id) || id <= 0) return undefined;
    return { type: "group", id };
  }

  // Private target: qq:12345
  if (normalized.startsWith(QQ_PREFIX)) {
    const idStr = normalized.slice(QQ_PREFIX.length);
    const id = Number.parseInt(idStr, 10);
    if (!Number.isFinite(id) || id <= 0) return undefined;
    return { type: "private", id };
  }

  return undefined;
}

/**
 * Format a QQ target for display.
 */
export function formatQQTarget(target: ParsedQQTarget): string {
  if (target.type === "group") {
    return `qq:group:${target.id}`;
  }
  return `qq:${target.id}`;
}

/**
 * Create a private message target.
 */
export function privateTarget(userId: number): string {
  return `${QQ_PREFIX}${userId}`;
}

/**
 * Create a group message target.
 */
export function groupTarget(groupId: number): string {
  return `${QQ_GROUP_PREFIX}${groupId}`;
}
