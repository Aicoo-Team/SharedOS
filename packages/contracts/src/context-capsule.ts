import { z } from "zod";

import { type ProtocolError } from "./protocol-error.js";

/**
 * A context capsule is the bounded, inspectable payload one agent may hand to
 * another when delegating work across a trust boundary.
 *
 * It exists because "send the model whatever context it asked for" is how a
 * private key, an `.env` file, or an unbounded transcript leaves the sender's
 * side. A capsule is capped, typed, content-addressed, and previewable without
 * disclosure: the receiving owner can see what is being offered — kind, label,
 * source path, size, digest — and decide, before any content is revealed.
 *
 * The capsule carries content, never authority. Whether the receiver may act on
 * it is a separate capability decision.
 */

const encoder = new TextEncoder();

function utf8ByteLength(value: string): number {
  return encoder.encode(value).length;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** What a capsule item is, so a reviewer can judge it without reading it. */
export const CONTEXT_CAPSULE_ITEM_KINDS = [
  "requirement",
  "diff",
  "file_excerpt",
  "error",
  "test_output",
  "decision",
  "freeform",
] as const;

export type ContextCapsuleItemKind = (typeof CONTEXT_CAPSULE_ITEM_KINDS)[number];

/** Total encoded size of the capsule, so one delegation cannot become a dump. */
export const MAX_CONTEXT_CAPSULE_ENCODED_BYTES = 128 * 1024;
/** Combined item content, bounded separately from envelope overhead. */
export const MAX_CONTEXT_CAPSULE_CONTENT_BYTES = 96 * 1024;
export const MAX_CONTEXT_CAPSULE_ITEMS = 12;
export const MAX_CONTEXT_CAPSULE_LIMITATIONS = 12;

/**
 * Paths whose contents are never appropriate to hand across a boundary, matched
 * on the declared source rather than the content, so a sender cannot launder a
 * credential file by relabelling it.
 */
const FORBIDDEN_SOURCE_PATH = new RegExp(
  String.raw`(^|[/\\])(?:\.env(?:\.|$)|id_(?:rsa|dsa|ecdsa|ed25519)$|credentials?(?:\.|$)|secrets?(?:\.|$))`,
  "i",
);

/**
 * A deliberately narrow content guard. It catches the shapes that are
 * unambiguously secrets; it is not a general scanner and must not be described
 * as one. The size caps and the human preview are the real controls.
 */
const OBVIOUS_SECRET = new RegExp(
  String.raw`-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|` +
    String.raw`(?:api[_-]?key|access[_-]?token|client[_-]?secret|password)\s*[:=]\s*["']?[A-Za-z0-9_\-/.+=]{12,}`,
  "i",
);

export const ContextCapsuleItemSchema = z
  .object({
    kind: z.enum(CONTEXT_CAPSULE_ITEM_KINDS),
    label: z.string().trim().min(1).max(120),
    content: z.string().min(1),
    sourcePath: z.string().trim().min(1).optional(),
    /** Lowercase hex SHA-256 of `content`, so a preview commits to the payload. */
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

export type ContextCapsuleItem = z.infer<typeof ContextCapsuleItemSchema>;

export const ContextCapsuleSchema = z
  .object({
    objective: z.string().trim().min(1),
    summary: z.string().trim().min(1).max(2_000),
    items: z.array(ContextCapsuleItemSchema).max(MAX_CONTEXT_CAPSULE_ITEMS),
    /** What the sender knows the capsule does not cover. */
    limitations: z.array(z.string().trim().min(1).max(500)).max(MAX_CONTEXT_CAPSULE_LIMITATIONS),
  })
  .strict();

export type ContextCapsule = z.infer<typeof ContextCapsuleSchema>;

export const ContextCapsulePreviewItemSchema = z
  .object({
    kind: z.string(),
    label: z.string(),
    sourcePath: z.string().optional(),
    contentBytes: z.number().int().nonnegative(),
    sha256: z.string(),
  })
  .strict();

/**
 * The disclosure-free projection of a capsule. It contains every field a
 * reviewer needs and no item content, so it is safe to render in an approval
 * prompt, persist alongside a pending request, or send to a client.
 */
export const ContextCapsulePreviewSchema = z
  .object({
    summary: z.string(),
    limitations: z.array(z.string()),
    items: z.array(ContextCapsulePreviewItemSchema),
  })
  .strict();

export type ContextCapsulePreview = z.infer<typeof ContextCapsulePreviewSchema>;
export type ContextCapsulePreviewItem = z.infer<typeof ContextCapsulePreviewItemSchema>;

export type ContextCapsuleValidation =
  { ok: true; value: ContextCapsule } | { ok: false; error: ProtocolError };

function invalid(code: string, message: string): { ok: false; error: ProtocolError } {
  return { ok: false, error: { code, message } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Validate an untrusted capsule against the objective it claims to serve.
 *
 * Every rejection returns its own code rather than one generic parse failure:
 * the caller reports these to the sender, and "your capsule is invalid" is not
 * actionable while "context_hash_mismatch" is.
 *
 * The objective is checked, not just carried. A capsule assembled for one task
 * must not be replayed against another, because the receiving owner approved
 * the disclosure for that task.
 *
 * Async because content integrity is verified with Web Crypto: SharedOS depends
 * on no Node built-in, and accepting an injected hash function would make the
 * integrity property optional for the caller who most wants to skip it.
 */
export async function validateContextCapsule(
  value: unknown,
  objective: string,
): Promise<ContextCapsuleValidation> {
  let encoded: string;
  try {
    encoded = JSON.stringify(value);
  } catch {
    return invalid("context_invalid", "The context capsule is not JSON-encodable.");
  }
  if (typeof encoded !== "string") {
    return invalid("context_invalid", "The context capsule is not JSON-encodable.");
  }
  if (utf8ByteLength(encoded) > MAX_CONTEXT_CAPSULE_ENCODED_BYTES) {
    return invalid("context_too_large", "The context capsule exceeds its encoded size limit.");
  }
  if (!isRecord(value)) {
    return invalid("context_invalid", "The context capsule must be an object.");
  }
  if (value.objective !== objective.trim()) {
    return invalid(
      "context_objective_mismatch",
      "The capsule objective does not match the delegated task.",
    );
  }
  if (typeof value.summary !== "string" || !value.summary.trim() || value.summary.length > 2_000) {
    return invalid("context_summary_invalid", "The capsule summary is missing or too long.");
  }
  if (!Array.isArray(value.items) || value.items.length > MAX_CONTEXT_CAPSULE_ITEMS) {
    return invalid("context_items_invalid", "The capsule items are missing or too many.");
  }
  if (
    !Array.isArray(value.limitations) ||
    value.limitations.length > MAX_CONTEXT_CAPSULE_LIMITATIONS
  ) {
    return invalid(
      "context_limitations_invalid",
      "The capsule limitations are missing or too many.",
    );
  }

  let contentBytes = 0;
  const items: ContextCapsuleItem[] = [];
  for (const item of value.items) {
    if (!isRecord(item)) {
      return invalid("context_item_invalid", "A capsule item is not an object.");
    }
    if (
      typeof item.kind !== "string" ||
      !(CONTEXT_CAPSULE_ITEM_KINDS as readonly string[]).includes(item.kind)
    ) {
      return invalid("context_item_kind_invalid", "A capsule item has an unrecognized kind.");
    }
    if (typeof item.label !== "string" || !item.label.trim() || item.label.length > 120) {
      return invalid("context_item_label_invalid", "A capsule item label is missing or too long.");
    }
    if (typeof item.content !== "string" || !item.content.trim()) {
      return invalid("context_item_content_invalid", "A capsule item has no content.");
    }
    contentBytes += utf8ByteLength(item.content);
    if (contentBytes > MAX_CONTEXT_CAPSULE_CONTENT_BYTES) {
      return invalid("context_content_too_large", "The capsule content exceeds its size limit.");
    }
    const sourcePath =
      typeof item.sourcePath === "string" && item.sourcePath.trim()
        ? item.sourcePath.trim()
        : undefined;
    if (sourcePath && FORBIDDEN_SOURCE_PATH.test(sourcePath)) {
      return invalid("context_source_forbidden", "A capsule item names a forbidden source path.");
    }
    if (OBVIOUS_SECRET.test(item.content)) {
      return invalid("context_secret_detected", "A capsule item appears to contain a secret.");
    }
    const sha256 = await sha256Hex(item.content);
    if (item.sha256 !== sha256) {
      return invalid("context_hash_mismatch", "A capsule item digest does not match its content.");
    }
    items.push({
      kind: item.kind as ContextCapsuleItemKind,
      label: item.label.trim(),
      content: item.content,
      ...(sourcePath ? { sourcePath } : {}),
      sha256,
    });
  }

  const limitations: string[] = [];
  for (const limitation of value.limitations) {
    if (typeof limitation !== "string" || !limitation.trim() || limitation.length > 500) {
      return invalid("context_limitation_invalid", "A capsule limitation is missing or too long.");
    }
    limitations.push(limitation.trim());
  }

  return {
    ok: true,
    value: { objective: objective.trim(), summary: value.summary.trim(), items, limitations },
  };
}

/**
 * Project a capsule down to what a reviewer may see before approving.
 *
 * Deliberately tolerant of malformed input: a preview is rendered for a request
 * that has not been accepted yet, so an unparseable capsule must degrade to a
 * partial preview rather than throw inside an approval surface. It never copies
 * item content — that is the one invariant this function has.
 */
export function contextCapsulePreview(value: unknown): ContextCapsulePreview | undefined {
  if (!isRecord(value) || typeof value.summary !== "string" || !Array.isArray(value.items)) {
    return undefined;
  }
  const items = value.items.flatMap((item): ContextCapsulePreviewItem[] => {
    if (
      !isRecord(item) ||
      typeof item.kind !== "string" ||
      typeof item.label !== "string" ||
      typeof item.content !== "string" ||
      typeof item.sha256 !== "string"
    ) {
      return [];
    }
    return [
      {
        kind: item.kind,
        label: item.label,
        ...(typeof item.sourcePath === "string" ? { sourcePath: item.sourcePath } : {}),
        contentBytes: utf8ByteLength(item.content),
        sha256: item.sha256,
      },
    ];
  });
  return {
    summary: value.summary,
    limitations: Array.isArray(value.limitations)
      ? value.limitations.filter((item): item is string => typeof item === "string")
      : [],
    items,
  };
}
