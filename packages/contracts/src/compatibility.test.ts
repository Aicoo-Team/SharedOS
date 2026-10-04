import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  assertProtocolVersion,
  AuthorizationDecisionSchema,
  AuditEventSchema,
  ExecutionEventSchema,
  ExecutionRequestSchema,
  ExecutionResultSchema,
  MessageEnvelopeSchema,
  PROTOCOL_VERSION,
  ProtocolVersionSchema,
  RuntimeManifestSchema,
  SharedOSToolCatalogSchema,
} from "./index.js";

// Frozen pre-ADR-0019 reader. Do not derive this from today's schema: doing so
// would let a schema edit silently change the reader we claim to support.
const OlderAuthorizationDecisionSchema = z
  .object({
    allowed: z.boolean(),
    reasonCode: z.string().trim().min(1).max(256),
    matchedGrantId: z.string().trim().min(1).max(256).optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .strict();

const denial = { allowed: false, reasonCode: "no_matching_grant" };
const describedDenial = {
  ...denial,
  requiredAuthority: {
    id: "ask-1",
    requester: { kind: "agent", agentId: "agent-1" },
    owner: { kind: "human", userId: "owner-1" },
    namespaceId: "world-1",
    purpose: "review",
    requestedAt: "2026-08-31T00:00:00.000Z",
    capabilities: [
      {
        resource: { namespace: "files", path: ["note"] },
        actions: ["read"],
        scope: "exact",
      },
    ],
  },
};

describe("wire compatibility epochs", () => {
  it("reproduces a v1 older reader rejecting an additive authority field without a version explanation", () => {
    expect(OlderAuthorizationDecisionSchema.safeParse(denial).success).toBe(true);
    const newer = AuthorizationDecisionSchema.parse(describedDenial);
    const old = OlderAuthorizationDecisionSchema.safeParse(newer);
    expect(old.success).toBe(false);
    if (!old.success) {
      expect(old.error.issues).toEqual([
        expect.objectContaining({ code: "unrecognized_keys", keys: ["requiredAuthority"] }),
      ]);
    }
    // Both participants stamped v1 in ADR 0019. That check concealed the break.
    expect(z.literal("1").safeParse("1").success).toBe(true);
  });

  it("supports old payload shapes within the new epoch and retains strict output validation", () => {
    expect(AuthorizationDecisionSchema.parse(denial)).toEqual(denial);
    expect(AuthorizationDecisionSchema.parse(describedDenial)).toEqual(describedDenial);
    expect(AuthorizationDecisionSchema.safeParse({ ...denial, future: true }).success).toBe(false);
  });

  it("reports an epoch mismatch before an older reader sees the new shape", () => {
    const olderReader = (version: string, payload: unknown) => {
      if (version !== "1") throw new Error("unsupported_protocol_version");
      return OlderAuthorizationDecisionSchema.parse(payload);
    };
    expect(() => olderReader(PROTOCOL_VERSION, describedDenial)).toThrow(
      "unsupported_protocol_version",
    );
    expect(() => assertProtocolVersion("1")).toThrow('supported version is "2"');
    expect(() => assertProtocolVersion("3")).toThrow('Unsupported SharedOS protocol version "3"');
    expect(() => assertProtocolVersion(PROTOCOL_VERSION)).not.toThrow();
  });

  it.each([
    ["request", ExecutionRequestSchema, "version"],
    ["event", ExecutionEventSchema, "version"],
    ["result", ExecutionResultSchema, "version"],
    ["message", MessageEnvelopeSchema, "version"],
    ["manifest", RuntimeManifestSchema, "protocolVersion"],
    ["audit", AuditEventSchema, "version"],
    ["catalogue", SharedOSToolCatalogSchema, "version"],
  ])("rejects old %s stamps with a version diagnostic", (_name, schema, field) => {
    const parsed = schema.safeParse({
      [field]: "1",
      ...(_name === "result" ? { status: "succeeded" } : {}),
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues).toContainEqual(
        expect.objectContaining({
          path: [field],
          message: 'Unsupported SharedOS protocol version "1"; supported version is "2".',
        }),
      );
    }
  });

  it("does not accept missing, numeric or unknown epochs", () => {
    for (const version of [undefined, 2, "99"]) {
      expect(ProtocolVersionSchema.safeParse(version).success).toBe(false);
    }
  });
});
