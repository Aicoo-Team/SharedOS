import type { Capability, CapabilityConstraints } from "@aicoo/sharedos-contracts";

import type { PrecedentKey } from "./key.js";

/**
 * A resolved escalation a human approved, and the width they approved.
 *
 * `capabilities` is what the owner actually said yes to, which is not always
 * what was asked: an owner who approves a narrower thing than the request named
 * produces a precedent narrower than its own key. Both are recorded, because
 * the key answers "was this the same question" and the capabilities answer "how
 * much did they allow".
 */
export interface ApprovedPrecedent {
  readonly outcome: "approved";
  /** The `CapabilityRequest.id` of the escalation this resolved. */
  readonly requestId: string;
  readonly key: PrecedentKey;
  readonly capabilities: readonly Capability[];
  readonly constraints: CapabilityConstraints;
  readonly decidedAt: string;
}

/**
 * A resolved escalation a human refused.
 *
 * It has no capabilities, and that absence is load-bearing rather than tidy: it
 * is why a proposed allow cannot read a width off a refusal. A denial needs no
 * width to be worth citing, so nothing is missing here -- there was never a
 * width to record. See `admitAutoDecision`.
 */
export interface RefusedPrecedent {
  readonly outcome: "refused";
  readonly requestId: string;
  readonly key: PrecedentKey;
  readonly decidedAt: string;
}

export type Precedent = ApprovedPrecedent | RefusedPrecedent;

/**
 * The trusted lookup for the precedents a proposal cites.
 *
 * SharedOS stores nothing. A precedent is a record of what one owner answered,
 * and that record belongs to the host that recorded the escalation -- so the
 * rows stay host-side and reach admission through this port, by id, at the
 * moment they are judged. Nothing here writes, expires, or garbage-collects a
 * row; a host that already records resolved escalations already has the
 * material and needs no new table.
 *
 * The port is asked for the ids a proposal named, and nothing else. It is not a
 * matcher: a search interface here would put ranking inside the kernel, which
 * is the one thing ADR 0022 keeps out. Whichever rows a host's matcher chose,
 * it cites them by id and they are re-read from the store, so a proposal can
 * never overstate what a precedent said.
 *
 * An implementation must resolve only within `namespaceId`, and must throw
 * rather than answer with a partial or stale set -- an admission built on a row
 * the store could not vouch for is exactly the widening nobody authorized.
 * `admitAutoDecision` fails closed on a throw and on any answer that is not
 * precisely the cited ids.
 */
export interface PrecedentLookup {
  load(namespaceId: string, requestIds: readonly string[]): Promise<readonly Precedent[]>;
}

/**
 * A process-local lookup over a fixed set of rows, for tests and single-process
 * hosts. Durable hosts inject their own store.
 */
export class InMemoryPrecedentLookup implements PrecedentLookup {
  readonly #byNamespace = new Map<string, Map<string, Precedent>>();

  constructor(precedents: readonly Precedent[] = []) {
    for (const precedent of precedents) {
      this.record(precedent);
    }
  }

  record(precedent: Precedent): void {
    const namespaceId = precedent.key.namespaceId;
    let rows = this.#byNamespace.get(namespaceId);
    if (rows === undefined) {
      rows = new Map<string, Precedent>();
      this.#byNamespace.set(namespaceId, rows);
    }
    rows.set(precedent.requestId, precedent);
  }

  async load(namespaceId: string, requestIds: readonly string[]): Promise<readonly Precedent[]> {
    const rows = this.#byNamespace.get(namespaceId);
    if (rows === undefined) {
      return [];
    }
    return requestIds
      .map((requestId) => rows.get(requestId))
      .filter((precedent): precedent is Precedent => precedent !== undefined);
  }
}
