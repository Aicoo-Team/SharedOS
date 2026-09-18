import {
  PROTOCOL_VERSION,
  SHAREDOS_VERSION,
  type JsonObject,
  type RuntimeManifest,
} from "@aicoo/sharedos-contracts";
import type { McpHarnessId } from "@aicoo/sharedos-mcp";

import type { HarnessProtocol, HarnessRequirements } from "./harness.js";

/** What one vendor harness is, stated once: its id, its codec, what it needs, how its records are named. */
export interface HarnessVendor {
  /** The id this harness goes by everywhere: manifests, requirements, MCP specs, scripts. */
  readonly id: McpHarnessId;
  readonly protocol: HarnessProtocol;
  /** What a live session needs before it can run. */
  readonly requirements: HarnessRequirements;
  /** The manifest of a turn the SharedOS loop drives, speaking the vendor's wire format. */
  readonly manifest: RuntimeManifest;
  /** The manifest of a turn the vendor CLI runs itself, connected over MCP. */
  readonly mcpManifest: RuntimeManifest;
}

export interface HarnessVendorDefinition {
  readonly id: McpHarnessId;
  readonly protocol: HarnessProtocol;
  /** Executable expected on PATH. */
  readonly executable: string;
  /** Environment variables, any one of which satisfies the credential need. */
  readonly credentialVariables: readonly string[];
  /**
   * The harness runs its own tools, so the permission-filtered catalogue
   * cannot be declared in a frame. Stamped on every record its driven manifest
   * produces, because a column whose catalogue arrived out of band is making a
   * narrower claim than one whose catalogue was on the wire.
   */
  readonly catalogueOutOfBand?: boolean;
  /** What else the MCP manifest says about how this harness reaches MCP. */
  readonly mcpMetadata?: JsonObject;
}

const PACKAGE = "@aicoo/sharedos-adapters";

/**
 * One vendor's manifests and requirements from its few facts.
 *
 * Every harness here can also authenticate from a session it stored itself
 * (`codex login`, a Claude subscription, `dsh`'s credentials file, Pi's
 * `auth.json`), so credentials are optional for all of them.
 */
export function defineHarnessVendor(definition: HarnessVendorDefinition): HarnessVendor {
  const { id, protocol } = definition;
  return Object.freeze({
    id,
    protocol,
    requirements: Object.freeze({
      harness: id,
      executable: definition.executable,
      credentialVariables: Object.freeze([...definition.credentialVariables]),
      credentialsOptional: true,
    }),
    manifest: Object.freeze({
      id: `sharedos.${id}`,
      version: SHAREDOS_VERSION,
      protocolVersion: PROTOCOL_VERSION,
      metadata: {
        package: PACKAGE,
        harness: id,
        wireProtocol: protocol.id,
        executionModel: "bounded-driver-loop",
        ...(definition.catalogueOutOfBand === true ? { catalogueDelivery: "out-of-band" } : {}),
      },
    }),
    mcpManifest: Object.freeze({
      id: `sharedos.${id}.mcp`,
      version: SHAREDOS_VERSION,
      protocolVersion: PROTOCOL_VERSION,
      metadata: {
        package: PACKAGE,
        harness: id,
        toolshare: "mcp",
        executionModel: "native-harness-loop",
        ...definition.mcpMetadata,
      },
    }),
  });
}
