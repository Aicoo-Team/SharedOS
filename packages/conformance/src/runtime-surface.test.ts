import { describe, expect, it } from "vitest";

import type { AccessContext } from "@aicoo/sharedos-contracts";
import type { ResolvedAuthority } from "@aicoo/sharedos-core";
import type {
  RuntimeHost,
  RuntimeTurnRequest,
  RuntimeVisibleContext,
} from "@aicoo/sharedos-runtime";

import { canonicalMove } from "./moves.js";

/**
 * The compile-time half of the "runtime attempts to read grants" row.
 *
 * The manifest's declared signal for that row is a compile failure, and a
 * manifest cannot observe one. So the claim is split: the row's run-time half
 * walks the surfaces a plugin is handed and finds no authority, and this file is
 * the half the compiler checks. It has no assertions to run -- `tsc` either
 * accepts it or the build fails -- but it lives beside the row it evidences so
 * the two are not maintained apart.
 *
 * Every `@ts-expect-error` here is an assertion in reverse: the line must not
 * compile, and TypeScript fails the build if it starts to.
 */
type Assert<T extends true> = T;

describe("the surface a runtime plugin is handed", () => {
  it("carries no authority at run time either", () => {
    // The row's run-time half. Kept here as a pointer rather than duplicated:
    // the attempt itself is declared in the move and issued by the adversary.
    const move = canonicalMove("grant_material_unreachable");
    const inspection = move.attempts.find(({ inspect }) => inspect !== undefined);

    expect(inspection?.expect.reasonCodes).toEqual(["no_grant_material_reachable"]);
  });
});

/** A resolved authority is not an access context, so it cannot be passed as one. */
function requiresAccessContext(_context: AccessContext): void {
  // Intentionally empty. Only its signature is under test.
}

export function resolvedAuthorityIsNotAnAccessContext(authority: ResolvedAuthority): void {
  // @ts-expect-error ResolvedAuthority carries grants and must never be usable
  // where an AccessContext is expected: that is the one conversion that would
  // put authority in reach of a provider, a tool handler, or a transport.
  requiresAccessContext(authority);
}

/** What a runtime sees is not what a decision is made against. */
export function runtimeContextIsNotAnAccessContext(context: RuntimeVisibleContext): void {
  // @ts-expect-error A RuntimeVisibleContext is missing the issuing authority
  // and namespace-management state an AccessContext carries, so the sanitised
  // context cannot be laundered back into an authorizing one.
  requiresAccessContext(context);
}

/** Neither the context nor the turn request has a field authority could ride in. */
export type ContextHasNoAuthority = Assert<
  "authority" extends keyof RuntimeVisibleContext ? false : true
>;
export type ContextHasNoGrants = Assert<
  "grants" extends keyof RuntimeVisibleContext ? false : true
>;
export type AccessContextHasNoGrants = Assert<"grants" extends keyof AccessContext ? false : true>;
export type TurnRequestContextIsSanitised = Assert<
  RuntimeTurnRequest["context"] extends RuntimeVisibleContext ? true : false
>;

/**
 * The host is exactly three members.
 *
 * Written as an exhaustive equality rather than a set of absences, because a
 * leak arrives as a field somebody added and a list of things to check for
 * would not have that field on it.
 */
export type HostIsExactlyLimitsCallAndEmit = Assert<
  keyof RuntimeHost extends "limits" | "invokeTool" | "emit"
    ? "limits" | "invokeTool" | "emit" extends keyof RuntimeHost
      ? true
      : false
    : false
>;
