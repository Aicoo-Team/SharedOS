import { describe, expect, it } from "vitest";

import type { ResourceReach, ToolDefinition } from "@aicoo/sharedos-contracts";

import { reachThroughTools } from "./reach.js";

function tool(name: string, namespace: string, resourceNamespace: string, action: string) {
  return {
    name,
    description: `${name} under test`,
    namespace,
    source: "sharedos",
    readWrite: "read",
    inputSchema: { type: "object" },
    requiredCapability: { resource: { namespace: resourceNamespace, path: [] }, action },
  } satisfies ToolDefinition;
}

const FILES_SEARCH = tool("files.search", "files", "files", "search");
// The tool namespace and the resource namespace are different vocabularies.
const MESSAGE_REQUEST = tool("messages.request", "messages", "sharedos.messaging", "send");

const FILES: ResourceReach = {
  namespace: "files",
  path: ["Work", "atlas"],
  actions: ["read", "search", "write"],
  scope: "descendants",
};
const MESSAGING: ResourceReach = {
  namespace: "sharedos.messaging",
  path: [],
  actions: ["send"],
  scope: "descendants",
};
const EXECUTION: ResourceReach = {
  namespace: "sharedos.execution",
  path: ["agent", "agent-alice"],
  actions: ["invoke"],
  scope: "exact",
};

describe("reachThroughTools", () => {
  it("keeps the entries some offered tool operates on, keyed on the resource namespace", () => {
    const narrowed = reachThroughTools(
      [FILES, MESSAGING, EXECUTION],
      [FILES_SEARCH, MESSAGE_REQUEST],
    );

    // `sharedos.messaging` stays although no tool namespace is called that, and
    // `sharedos.execution` goes although the turn is authorized there: no
    // offered tool can act on it, so it is not somewhere this turn can work.
    expect(narrowed).toEqual([FILES, MESSAGING]);
  });

  it("keeps nothing for a turn offered no tools", () => {
    expect(reachThroughTools([FILES, MESSAGING], [])).toEqual([]);
  });

  it("leaves actions as the grants state them", () => {
    // The tool requires `search` to be discoverable; that is a ceiling, not the
    // action a call is authorized against, so it narrows nothing inside an entry.
    expect(reachThroughTools([FILES], [FILES_SEARCH])).toEqual([FILES]);
  });

  it("returns copies, so a runtime cannot edit what the envelope decided from", () => {
    const narrowed = reachThroughTools([FILES], [FILES_SEARCH]);
    (narrowed[0]?.actions as string[]).push("delete");

    expect(FILES.actions).toEqual(["read", "search", "write"]);
  });
});
