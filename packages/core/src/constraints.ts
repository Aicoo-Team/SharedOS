import type { CapabilityConstraints } from "@aicoo/sharedos-contracts";

import { parseTimestamp } from "./internal.js";

/**
 * The fields that bound *when* and *for what* a capability may be used.
 *
 * These three are ordered: one window sits inside another, one purpose set is
 * a subset of another. `maxUses` and `delegationDepth` are budgets, spent where
 * they are counted -- the usage store and the delegation chain -- and a
 * containment check has nothing to say about them.
 */
export type ConstraintEnvelopeField = "purposes" | "notBefore" | "expiresAt";

/**
 * The first field on which `inner` reaches outside `outer`, or `undefined`
 * when `inner` is within `outer`.
 *
 * One ordering, written once. An absent bound on `outer` admits anything; a
 * present one requires the same bound on `inner`, readable and at least as
 * tight: an expiry no later, a start no earlier, purposes that are a subset. A
 * present timestamp that does not parse, on either side, violates its field
 * rather than counting as absent, because a bound that cannot be read must not
 * read as unbounded.
 *
 * Fields are checked in the order they are declared, so a caller that reports
 * one violation reports the same one every time.
 */
export function constraintEnvelopeViolation(
  inner: CapabilityConstraints,
  outer: CapabilityConstraints,
): ConstraintEnvelopeField | undefined {
  if (outer.purposes !== undefined) {
    if (inner.purposes === undefined) {
      return "purposes";
    }
    const allowed = new Set(outer.purposes);
    if (!inner.purposes.every((purpose) => allowed.has(purpose))) {
      return "purposes";
    }
  }
  if (!instantIsWithin(inner.notBefore, outer.notBefore, "start")) {
    return "notBefore";
  }
  if (!instantIsWithin(inner.expiresAt, outer.expiresAt, "end")) {
    return "expiresAt";
  }
  return undefined;
}

/**
 * True when every use `inner` admits, `outer` admits too.
 *
 * The boolean of {@link constraintEnvelopeViolation}, for callers with nothing
 * to report about which field failed.
 */
export function constraintsAreWithin(
  inner: CapabilityConstraints,
  outer: CapabilityConstraints,
): boolean {
  return constraintEnvelopeViolation(inner, outer) === undefined;
}

/**
 * The tightest envelope every set admits, or `undefined` when they admit
 * nothing in common.
 *
 * The meet of the ordering {@link constraintEnvelopeViolation} checks: the
 * earliest expiry, the latest start, the intersection of purposes, the fewest
 * uses, the shallowest delegation. An absent bound on one set is not a bound
 * of zero -- an approval with no expiry does not stop a co-cited approval's
 * expiry from being the tightest one -- so absent bounds are skipped, and the
 * meet of no sets is unbounded.
 *
 * Disjoint bounds have no envelope. Purposes that intersect to nothing, a
 * window whose start is past its end, or a timestamp that cannot be read all
 * yield `undefined` rather than a clamped or guessed bound.
 */
export function tightestConstraints(
  sets: readonly CapabilityConstraints[],
): CapabilityConstraints | undefined {
  let purposes: Set<string> | undefined;
  let notBefore: { readonly value: string; readonly at: number } | undefined;
  let expiresAt: { readonly value: string; readonly at: number } | undefined;
  let maxUses: number | undefined;
  let delegationDepth: number | undefined;

  for (const constraints of sets) {
    if (constraints.purposes !== undefined) {
      const allowed = new Set(constraints.purposes);
      purposes =
        purposes === undefined
          ? allowed
          : new Set([...purposes].filter((purpose) => allowed.has(purpose)));
    }
    if (constraints.notBefore !== undefined) {
      const at = parseTimestamp(constraints.notBefore);
      if (at === undefined) {
        return undefined;
      }
      if (notBefore === undefined || at > notBefore.at) {
        notBefore = { value: constraints.notBefore, at };
      }
    }
    if (constraints.expiresAt !== undefined) {
      const at = parseTimestamp(constraints.expiresAt);
      if (at === undefined) {
        return undefined;
      }
      if (expiresAt === undefined || at < expiresAt.at) {
        expiresAt = { value: constraints.expiresAt, at };
      }
    }
    if (constraints.maxUses !== undefined) {
      maxUses =
        maxUses === undefined ? constraints.maxUses : Math.min(maxUses, constraints.maxUses);
    }
    if (constraints.delegationDepth !== undefined) {
      delegationDepth =
        delegationDepth === undefined
          ? constraints.delegationDepth
          : Math.min(delegationDepth, constraints.delegationDepth);
    }
  }

  if (purposes !== undefined && purposes.size === 0) {
    return undefined;
  }
  if (notBefore !== undefined && expiresAt !== undefined && notBefore.at > expiresAt.at) {
    return undefined;
  }

  return {
    ...(purposes === undefined ? {} : { purposes: [...purposes].sort() }),
    ...(notBefore === undefined ? {} : { notBefore: notBefore.value }),
    ...(expiresAt === undefined ? {} : { expiresAt: expiresAt.value }),
    ...(maxUses === undefined ? {} : { maxUses }),
    ...(delegationDepth === undefined ? {} : { delegationDepth }),
  };
}

function instantIsWithin(
  inner: string | undefined,
  outer: string | undefined,
  edge: "start" | "end",
): boolean {
  const innerAt = parseTimestamp(inner);
  const outerAt = parseTimestamp(outer);
  if (
    (inner !== undefined && innerAt === undefined) ||
    (outer !== undefined && outerAt === undefined)
  ) {
    return false;
  }
  if (outerAt === undefined) {
    return true;
  }
  if (innerAt === undefined) {
    return false;
  }
  return edge === "start" ? innerAt >= outerAt : innerAt <= outerAt;
}
