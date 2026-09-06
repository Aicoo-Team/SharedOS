import { describe, expect, it } from "vitest";

import { diagnoseBatch, diagnoseDenial } from "./diagnose.js";

import type { AuditEvent } from "@aicoo/sharedos-core";
import type { ToolResult } from "@aicoo/sharedos-contracts";

// ============================================================
// Helpers
// ============================================================

function deniedResult(code: string, message = `denied: ${code}`): ToolResult {
  return {
    callId: "call-1",
    tool: "files.search",
    completedAt: "2026-01-01T00:00:00.000Z",
    status: "denied",
    error: { code, message, retryable: false },
  };
}

function succeededResult(): ToolResult {
  return {
    callId: "call-1",
    tool: "files.search",
    completedAt: "2026-01-01T00:00:00.000Z",
    status: "succeeded",
    output: { hits: [] },
  };
}

function makeAuditEvent(
  overrides: Partial<AuditEvent> & { type: AuditEvent["type"]; outcome: AuditEvent["outcome"] },
): AuditEvent {
  return {
    version: "1",
    at: "2026-01-01T00:00:00.000Z",
    traceId: "trace-1",
    namespaceId: "acme",
    actor: { kind: "agent", agentId: "agent-1" },
    authority: { kind: "human", userId: "owner-1" },
    owner: { kind: "human", userId: "owner-1" },
    purpose: "test",
    ...overrides,
  };
}

// ============================================================
// Tests
// ============================================================

describe("diagnoseDenial", () => {
  it("returns passthrough for non-denials", () => {
    const result = succeededResult();
    const diagnosis = diagnoseDenial(result);
    expect(diagnosis.gate).toBe("unknown");
    expect(diagnosis.code).toBe("succeeded");
    expect(diagnosis.message).toContain("not a denial");
  });

  // ── Registration gate ──

  describe("registration gate", () => {
    it("diagnoses tool_unavailable", () => {
      const diagnosis = diagnoseDenial(deniedResult("tool_unavailable"));
      expect(diagnosis.gate).toBe("registration");
      expect(diagnosis.code).toBe("tool_unavailable");
      expect(diagnosis.message).toContain("not registered");
      expect(diagnosis.nextStep).toContain("metadata.cause");
    });

    it("enriches tool_unavailable with cause: not_registered from audit", () => {
      const events = [
        makeAuditEvent({
          type: "tool.invoked",
          outcome: "denied",
          tool: "files.read",
          metadata: { cause: "not_registered", source: "kernel" },
        }),
      ];
      const diagnosis = diagnoseDenial(deniedResult("tool_unavailable"), events);
      expect(diagnosis.metadata?.cause).toBe("not_registered");
      expect(diagnosis.metadata?.summary).toContain("not registered");
    });

    it("enriches tool_unavailable with cause: namespace_disabled from audit", () => {
      const events = [
        makeAuditEvent({
          type: "tool.invoked",
          outcome: "denied",
          tool: "files.read",
          metadata: { cause: "namespace_disabled", source: "kernel" },
        }),
      ];
      const diagnosis = diagnoseDenial(deniedResult("tool_unavailable"), events);
      expect(diagnosis.metadata?.cause).toBe("namespace_disabled");
      expect(diagnosis.metadata?.summary).toContain("namespace is disabled");
    });

    it("overrides gate to capability_grant when cause is no_matching_grant", () => {
      const events = [
        makeAuditEvent({
          type: "tool.invoked",
          outcome: "denied",
          tool: "files.read",
          metadata: { cause: "no_matching_grant", source: "kernel" },
        }),
      ];
      const diagnosis = diagnoseDenial(deniedResult("tool_unavailable"), events);
      expect(diagnosis.gate).toBe("capability_grant");
      expect(diagnosis.metadata?.cause).toBe("no_matching_grant");
      expect(diagnosis.metadata?.summary).toContain("no grant makes it discoverable");
    });

    it("overrides gate to product_ceiling when cause is host_policy_denied", () => {
      const events = [
        makeAuditEvent({
          type: "tool.invoked",
          outcome: "denied",
          tool: "files.read",
          metadata: { cause: "host_policy_denied", source: "kernel" },
        }),
      ];
      const diagnosis = diagnoseDenial(deniedResult("tool_unavailable"), events);
      expect(diagnosis.gate).toBe("product_ceiling");
      expect(diagnosis.metadata?.cause).toBe("host_policy_denied");
      expect(diagnosis.metadata?.summary).toContain("host ceiling policy blocked");
    });
  });

  // ── Capability grant gate ──

  describe("capability_grant gate", () => {
    it("diagnoses no_matching_grant", () => {
      const diagnosis = diagnoseDenial(deniedResult("no_matching_grant"));
      expect(diagnosis.gate).toBe("capability_grant");
      expect(diagnosis.code).toBe("no_matching_grant");
      expect(diagnosis.message).toContain("No grant covers");
    });

    it("enriches no_matching_grant with rejectedGrants from audit", () => {
      const events = [
        makeAuditEvent({
          type: "authorization.checked",
          outcome: "denied",
          resource: { namespace: "files", path: ["Work"] },
          action: "search",
          metadata: {
            grantsResolved: 2,
            rejectedGrants: [
              { grantId: "grant-1", reason: "issuer" },
              { grantId: "grant-2", reason: "capability" },
            ],
          },
        }),
      ];
      const diagnosis = diagnoseDenial(deniedResult("no_matching_grant"), events);
      expect(diagnosis.metadata?.grantsResolved).toBe(2);
      expect(diagnosis.metadata?.rejectedGrants).toBeDefined();
      expect(diagnosis.metadata?.summary).toContain("grant-1: issuer");
    });

    it("enriches no_matching_grant when grantsResolved is 0", () => {
      const events = [
        makeAuditEvent({
          type: "authorization.checked",
          outcome: "denied",
          metadata: { grantsResolved: 0, rejectedGrants: [] },
        }),
      ];
      const diagnosis = diagnoseDenial(deniedResult("no_matching_grant"), events);
      expect(diagnosis.metadata?.summary).toContain("zero grants");
    });

    it("diagnoses grant_exhausted", () => {
      const diagnosis = diagnoseDenial(deniedResult("grant_exhausted"));
      expect(diagnosis.gate).toBe("capability_grant");
      expect(diagnosis.code).toBe("grant_exhausted");
      expect(diagnosis.message).toContain("maxUses");
    });

    it("diagnoses trace_mismatch", () => {
      const diagnosis = diagnoseDenial(deniedResult("trace_mismatch"));
      expect(diagnosis.gate).toBe("capability_grant");
      expect(diagnosis.code).toBe("trace_mismatch");
    });
  });

  // ── Product ceiling gate ──

  describe("product_ceiling gate", () => {
    it("diagnoses host_policy_denied", () => {
      const diagnosis = diagnoseDenial(deniedResult("host_policy_denied"));
      expect(diagnosis.gate).toBe("product_ceiling");
      expect(diagnosis.code).toBe("host_policy_denied");
      expect(diagnosis.message).toContain("host ceiling");
    });

    it("enriches host_policy_denied with overridden grant from audit", () => {
      const events = [
        makeAuditEvent({
          type: "authorization.checked",
          outcome: "denied",
          metadata: { grantedId: "grant-5", source: "kernel" },
        }),
      ];
      const diagnosis = diagnoseDenial(deniedResult("host_policy_denied"), events);
      expect(diagnosis.metadata?.overriddenGrantId).toBe("grant-5");
    });
  });

  // ── Infrastructure gate ──

  describe("infrastructure gate", () => {
    it("diagnoses usage_store_unavailable", () => {
      const diagnosis = diagnoseDenial(deniedResult("usage_store_unavailable"));
      expect(diagnosis.gate).toBe("infrastructure");
      expect(diagnosis.code).toBe("usage_store_unavailable");
      expect(diagnosis.message).toContain("usageStore");
    });

    it("enriches usage_store_unavailable with missingDependency from audit", () => {
      const events = [
        makeAuditEvent({
          type: "authorization.checked",
          outcome: "denied",
          metadata: { failClosed: true, missingDependency: "usageStore" },
        }),
      ];
      const diagnosis = diagnoseDenial(deniedResult("usage_store_unavailable"), events);
      expect(diagnosis.metadata?.failClosed).toBe(true);
      expect(diagnosis.metadata?.missingDependency).toBe("usageStore");
      expect(diagnosis.metadata?.summary).toContain("configuration problem");
    });

    it("diagnoses delegation_chain_unverified", () => {
      const diagnosis = diagnoseDenial(deniedResult("delegation_chain_unverified"));
      expect(diagnosis.gate).toBe("infrastructure");
      expect(diagnosis.code).toBe("delegation_chain_unverified");
      expect(diagnosis.message).toContain("delegationResolver");
    });

    it("diagnoses authority_unavailable", () => {
      const diagnosis = diagnoseDenial(deniedResult("authority_unavailable"));
      expect(diagnosis.gate).toBe("infrastructure");
      expect(diagnosis.code).toBe("authority_unavailable");
      expect(diagnosis.message).toContain("GrantSource");
    });
  });

  // ── Delegation gate ──

  describe("delegation gate", () => {
    it("diagnoses delegation_chain_invalid", () => {
      const diagnosis = diagnoseDenial(deniedResult("delegation_chain_invalid"));
      expect(diagnosis.gate).toBe("delegation");
      expect(diagnosis.code).toBe("delegation_chain_invalid");
      expect(diagnosis.message).toContain("chain resolved");
    });

    it("enriches delegation_chain_invalid with chain detail from audit", () => {
      const events = [
        makeAuditEvent({
          type: "authorization.checked",
          outcome: "denied",
          metadata: {
            delegation: { grantId: "child-1", reason: "parent_inactive" },
          },
        }),
      ];
      const diagnosis = diagnoseDenial(deniedResult("delegation_chain_invalid"), events);
      expect(diagnosis.metadata?.delegation).toBeDefined();
      expect(diagnosis.metadata?.summary).toContain("child-1");
    });
  });

  // ── Turn gate ──

  describe("turn gate", () => {
    it("diagnoses actor_mismatch", () => {
      const diagnosis = diagnoseDenial(deniedResult("actor_mismatch"));
      expect(diagnosis.gate).toBe("turn");
      expect(diagnosis.code).toBe("actor_mismatch");
      expect(diagnosis.message).toContain("not the admitted one");
    });

    it("diagnoses step_limit_exceeded", () => {
      const diagnosis = diagnoseDenial(deniedResult("step_limit_exceeded"));
      expect(diagnosis.gate).toBe("envelope");
      expect(diagnosis.code).toBe("step_limit_exceeded");
      expect(diagnosis.message).toContain("maxSteps");
    });

    it("diagnoses tool_call_limit_exceeded", () => {
      const diagnosis = diagnoseDenial(deniedResult("tool_call_limit_exceeded"));
      expect(diagnosis.gate).toBe("envelope");
      expect(diagnosis.code).toBe("tool_call_limit_exceeded");
      expect(diagnosis.message).toContain("maxToolCalls");
    });
  });

  // ── Unknown code ──

  it("handles unknown refusal codes", () => {
    const diagnosis = diagnoseDenial(deniedResult("something_new"));
    expect(diagnosis.gate).toBe("unknown");
    expect(diagnosis.code).toBe("something_new");
    expect(diagnosis.message).toContain("Unknown refusal code");
    expect(diagnosis.nextStep).toContain("docs/errors.md");
  });

  // ── Audit source extraction ──

  it("extracts audit source from metadata", () => {
    const events = [
      makeAuditEvent({
        type: "tool.invoked",
        outcome: "denied",
        metadata: { cause: "not_registered", source: "envelope" },
      }),
    ];
    const diagnosis = diagnoseDenial(deniedResult("tool_unavailable"), events);
    expect(diagnosis.metadata?.auditSource).toBe("envelope");
  });
});

describe("diagnoseBatch", () => {
  it("returns one diagnosis per result", () => {
    const results = [
      deniedResult("no_matching_grant"),
      deniedResult("tool_unavailable"),
      deniedResult("host_policy_denied"),
      succeededResult(),
    ];
    const batch = diagnoseBatch(results);
    expect(batch).toHaveLength(4);
    expect(batch[0]!.diagnosis.gate).toBe("capability_grant");
    expect(batch[1]!.diagnosis.gate).toBe("registration");
    expect(batch[2]!.diagnosis.gate).toBe("product_ceiling");
    expect(batch[3]!.diagnosis.gate).toBe("unknown");
  });
});
