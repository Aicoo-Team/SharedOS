# Open items for review

Declarations an audit of the repository found exported, tested, and documented
but wired to nothing, or set by nothing, and that were kept rather than removed
because each carries a design intent someone may still want. Each row names the
decision that would close it. The dead surface with no such intent was removed
instead (changelog, `0.1.0-alpha.3`, "Removed").

A reviewer picking one up should decide it one way — wire it, or remove it — and
delete its row; a row that stays for another release should say why.

| Item                                                    | Where                                                           | State                                                                                                                                                                                                                                                                                                                                                               | Decision                                                                                                                                                                    |
| ------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MessageEnvelope.provenance`, `MessageProvenanceSchema` | `packages/contracts/src/message.ts`                             | Optional field a host may set; the kernel neither sets nor reads it.                                                                                                                                                                                                                                                                                                | Either the kernel records a hop — sets `source` and `parentIds` when a message is forwarded — or the field is documented as host-owned metadata, which is what it is today. |
| `HarnessMcpConnection.timeoutSec`                       | `packages/mcp/src/harness-config.ts`                            | Read by the three config emitters and, through `codexMcpServerSettings`, by the Codex launch; set by nothing, so every consumer sees `DEFAULT_TIMEOUT_SEC`.                                                                                                                                                                                                         | Set it on the connection the runtime builds, or remove it from the connection.                                                                                              |
| `ProtocolVersionSchema`                                 | `packages/contracts/src/common.ts`                              | Still `z.literal("1")` after this release added optional fields to `.strict()` schemas an older reader will reject. One literal shared by `ExecutionRequest`, `ExecutionEvent`, `ExecutionResult`, `MessageEnvelope`, and `RuntimeManifest`, so moving it re-stamps four objects that did not change. ADR 0019 records the deferral; the changelog names the break. | Bump it in the next release that has its own reason to, carrying this with it — or split the literal so an object can be versioned without re-stamping the other four.      |
| `SharedOSKernel.readAgentCard`, `AgentCardViewSchema`   | `packages/core/src/kernel.ts`, `packages/contracts/src/card.ts` | ADR 0021 says a card is published to the model as `sharedos.card`, the way `sharedos.escalate` is. The kernel method is built and tested; no tool, route or bridge serves it, so nothing outside `agent-card.test.ts` calls it, and the view schema waits to be that tool's argument schema.                                                                        | Build the `sharedos.card` published tool over `readAgentCard`, or revise ADR 0021 to say the card is an in-process read and drop the view schema.                           |

Also recorded by the audit and not yet decided, each declared and never set or
never read: `HarnessMcpConfigFile.harness`; `HarnessStep.complete.metadata`;
`EvalHarnessDriverOptions.maxIgnoredFrames` (never set, and its two failure paths
have no unit test); `OpenAiCompatibleModelClientOptions.maxOutputTokens`,
`temperature`, and `requestTimeoutMs` (read with defaults, set by no script);
`catalogueDelivery` manifest metadata;
`ToolAliasRecord.at`. Each is a declaration with no in-repo writer or reader;
`git grep` on the name is the evidence.

Five fields of the execution record have no writer in this repository on
purpose: `ExperimentIdentity.seed` and `metadata`, `StateReference.capturedAt`,
`StateRecord.diffRef`, and `AssembleExecutionRecordInput.auditRef`. The record
gives experiment identity and state references to the experiment layer that
seeded the world, and SharedOS neither captures a snapshot nor owns audit
storage, so their writer is a host. No host in the workspace imports the package
yet. They stay until one does, or until one decides it never will.
