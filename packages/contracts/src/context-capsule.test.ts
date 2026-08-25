import { describe, expect, it } from "vitest";

import {
  ContextCapsulePreviewSchema,
  ContextCapsuleSchema,
  MAX_CONTEXT_CAPSULE_CONTENT_BYTES,
  contextCapsulePreview,
  validateContextCapsule,
} from "./index.js";

const objective = "Review my pending diff";
const content = "+const enabled = true;";

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function capsule() {
  return {
    objective,
    summary: "Checkout changes for review",
    items: [
      {
        kind: "diff",
        label: "git diff",
        content,
        sourcePath: "src/app.ts",
        sha256: await sha256Hex(content),
      },
    ],
    limitations: ["Tests were not run"],
  };
}

describe("context capsules", () => {
  it("accepts a well-formed capsule and returns a value the schema parses", async () => {
    const input = await capsule();
    const result = await validateContextCapsule(input, objective);

    expect(result).toEqual({ ok: true, value: input });
    // The hand-written validator and the published schema must not drift apart.
    expect(() => ContextCapsuleSchema.parse(result.ok && result.value)).not.toThrow();
  });

  it("previews a capsule without disclosing any item content", async () => {
    const input = await capsule();
    const preview = contextCapsulePreview(input);

    expect(preview).toEqual({
      summary: "Checkout changes for review",
      limitations: ["Tests were not run"],
      items: [
        {
          kind: "diff",
          label: "git diff",
          sourcePath: "src/app.ts",
          contentBytes: new TextEncoder().encode(content).length,
          sha256: input.items[0]?.sha256,
        },
      ],
    });
    expect(JSON.stringify(preview)).not.toContain(content);
    expect(() => ContextCapsulePreviewSchema.parse(preview)).not.toThrow();
  });

  it("previews a malformed capsule rather than throwing inside an approval surface", () => {
    const preview = contextCapsulePreview({
      summary: "partial",
      items: [{ kind: "diff" }, { kind: "diff", label: "ok", content: "x", sha256: "abc" }],
    });

    expect(preview?.items).toHaveLength(1);
    expect(preview?.limitations).toEqual([]);
    expect(contextCapsulePreview("not an object")).toBeUndefined();
  });

  it("rejects content that does not match its declared digest", async () => {
    const input = await capsule();
    const result = await validateContextCapsule(
      { ...input, items: [{ ...input.items[0], content: "changed" }] },
      objective,
    );

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error.code).toBe("context_hash_mismatch");
  });

  it("rejects obvious secret material in item content", async () => {
    const secret = "access_token=abcdefghijklmnopqrstuvwxyz";
    const input = await capsule();
    const result = await validateContextCapsule(
      {
        ...input,
        items: [{ ...input.items[0], content: secret, sha256: await sha256Hex(secret) }],
      },
      objective,
    );

    expect(result.ok === false && result.error.code).toBe("context_secret_detected");
  });

  it("rejects a credential file by its declared source path", async () => {
    const input = await capsule();
    const result = await validateContextCapsule(
      { ...input, items: [{ ...input.items[0], sourcePath: "config/.env.production" }] },
      objective,
    );

    expect(result.ok === false && result.error.code).toBe("context_source_forbidden");
  });

  it("rejects a capsule assembled for a different objective", async () => {
    const result = await validateContextCapsule(await capsule(), "Deploy to production");

    expect(result.ok === false && result.error.code).toBe("context_objective_mismatch");
  });

  it("bounds total item content", async () => {
    const oversized = "a".repeat(MAX_CONTEXT_CAPSULE_CONTENT_BYTES + 1);
    const input = await capsule();
    const result = await validateContextCapsule(
      {
        ...input,
        items: [{ ...input.items[0], content: oversized, sha256: await sha256Hex(oversized) }],
      },
      objective,
    );

    expect(result.ok === false && result.error.code).toBe("context_content_too_large");
  });
});
