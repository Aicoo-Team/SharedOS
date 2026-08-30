# Open items for review

Declarations an audit of the repository found exported, tested, and documented
but wired to nothing, or set by nothing, and that were kept rather than removed
because each carries a design intent someone may still want. Each row names the
decision that would close it. The dead surface with no such intent was removed
instead (changelog, `0.1.0-alpha.3`, "Removed").

A reviewer picking one up should decide it one way — wire it, or remove it — and
delete its row; a row that stays for another release should say why.

| Item                                                                                                    | Where                                       | State                                                                                                                                                                                                                            | Decision                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ContextCapsule`, `validateContextCapsule`, `contextCapsulePreview`, the `MAX_CONTEXT_CAPSULE_*` limits | `packages/contracts/src/context-capsule.ts` | Exported and tested; no message, tool, or turn path carries a capsule. `errors.md` lists its limits.                                                                                                                             | Give a capsule a carrier — a message payload shape or a tool argument the kernel validates — or remove it with its limits.                                                  |
| `CapabilityRequest`, `CapabilityRequestSchema`                                                          | `packages/contracts/src/capability.ts`      | Exported; no port accepts one. `security/permission-model.md` names it as the consent-workflow request.                                                                                                                          | Define the port an issuer receives it through, or remove it and the permission-model sentence.                                                                              |
| `MessageEnvelope.provenance`, `MessageProvenanceSchema`                                                 | `packages/contracts/src/message.ts`         | Optional field a host may set; the kernel neither sets nor reads it.                                                                                                                                                             | Either the kernel records a hop — sets `source` and `parentIds` when a message is forwarded — or the field is documented as host-owned metadata, which is what it is today. |
| `ColumnLimits.unsupported`                                                                              | `packages/conformance/src/columns.ts`       | No committed column sets it, so the `not_applicable` cell it declares and the `turns === 0` render branch are unreachable with every in-repo column.                                                                             | Keep for a host-authored column and say so in the conformance README, or remove it with its two branches.                                                                   |
| `AttemptReceipt.forgedGrantId`                                                                          | `packages/conformance/src/adversary.ts`     | In the receipt schema; never assigned.                                                                                                                                                                                           | Have the forged-grant move report the id it forged, or drop the field.                                                                                                      |
| `HarnessMcpConnection.timeoutSec`                                                                       | `packages/mcp/src/harness-config.ts`        | Read by the three config emitters, set by nothing; the MCP harness runtime's Codex launch (`packages/adapters/src/mcp-runtime.ts`) hard-codes `tool_timeout_sec=120` as a `-c` override, independently of `DEFAULT_TIMEOUT_SEC`. | Set it on the connection the runtime builds and have the Codex launch read it, or remove it from the connection.                                                            |
| `OpenToolBridgeOptions.step`                                                                            | `packages/mcp/src/bridge.ts`                | Neither caller passes it, so an MCP-mediated call never declares a step and the envelope's step ceiling does not apply on that path; `maxToolCalls` alone bounds it.                                                             | Have the MCP runtime count its calls into a step, or remove the option and document the path as call-bounded — which `mcp-toolshare.md` should say either way.              |
| `TurnExecutor`                                                                                          | `packages/runtime/src/executor.ts`          | Compatibility facade over `SharedOSExecutor` for the original driver API; used by tests and the pack smoke test, shown as a shorthand in the runtime README.                                                                     | Deprecate with a removal release named, or keep it as supported API and give it a test of its own.                                                                          |
| `MID_TURN_AUTHORITY_REFRESH`                                                                            | `packages/core/src/authority.ts`            | ADR 0010's fuse, an exported `const false`. A host cannot set it: turning it on means patching the package.                                                                                                                      | Keep it as a maintainers' build-time switch, which its docblock now says, or make it a kernel option with the store read per operation stated.                              |

Also recorded by the audit and not yet decided, each declared and never set or
never read: `ConformanceWorldOptions.now`; `HostileRuntimeOptions.version`, the
`HostileRuntime.moves`, `ConformanceGrantSource.loads`, and
`SpanCollector.pause`/`resume`/`named` accessors, `RecordingMessageRouter.replies`,
the `AttackMoveKind` type; `SystemIdentity.toolPolicy` and `adapterVersion`,
`ExperimentIdentity.seed` and `metadata`, `StateRecord.diffRef`,
`StateReference.capturedAt`, `AssembleExecutionRecordInput.auditRef`;
`HarnessMcpConfigFile.harness`; `HarnessStep.complete.metadata`;
`HarnessDriverOptions.maxIgnoredFrames` (never set, and its two failure paths
have no unit test); `OpenAiCompatibleModelClientOptions.maxOutputTokens`,
`temperature`, and `requestTimeoutMs` (read with defaults, set by no script);
the `callsAfterEscalation`, `harnessOutcome`, and `harnessErrorCode` metadata
(reach `ExecutionResult.metadata`, surface in no published artifact);
`catalogueDelivery` manifest metadata; `ChildProcessChannel.stderr`;
`ToolAliasRecord.at`. Each is a declaration with no in-repo writer or reader;
`git grep` on the name is the evidence.
