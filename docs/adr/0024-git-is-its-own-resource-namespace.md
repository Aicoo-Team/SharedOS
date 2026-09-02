# ADR 0024: Git is its own resource namespace, and the vetted subset is a provider

- Status: Proposed
- Date: 2026-09-02
- Extends: `docs/adr/0005-files-resource-plane.md`

## Context

ADR 0005 settled that a resource path, not a tool name, is what a grant names.
Phase 10 of the Pulse migration applies that to the last vocabulary still keyed
on tool names, and Git is the part of it that does not fit the existing plane.

The local agent vets Git through `safe-git.ts`: five subcommands — `status`,
`diff`, `log`, `add`, `commit` — each behind an argument allowlist, invoked with
hooks, system and global config, external diff drivers, textconv, and clean
filters all disabled, with paths canonicalized against the repository and
symlinks refused. Everything outside the five stays `shell.command`. Today those
five are simultaneously the permission vocabulary: the string `GitCommit` is
both the name of a function and the name of an authority, and a preset that
lists it is what makes committing possible.

Removing the tool names leaves the question this ADR answers: which resource
does a Git operation name? A repository is a directory, a files provider can
already address that directory, and `git add` and `git commit` change bytes
under it. Modelling them as `files` actions therefore looks like reuse rather
than a decision.

It is a decision, and the wrong one. `capabilityMatches` compares
`resource.namespace` first and requires equality; the action set is consulted
only inside a namespace. So the namespace is where a plane's authority begins
and ends, and putting Git inside `files` means Git authority is drawn from the
same capabilities as file authority. `git commit` as a write action under
`files` makes every holder of file-write authority over a working tree a holder
of commit authority — nobody grants it, no record shows it being granted, and it
follows from the shape alone. That is the permission cross-product ADR 0005
refused when it declined to standardize `move` and `copy`, and here it is worse
than a modelling smell: it is a live widening of the host being migrated, where
`GitCommit` is issued separately from file editing and a preset can hold one
without the other. A migration whose stated goal is to remove tool names from
the permission vocabulary must not hand commit authority to everyone who could
edit a file on the way past.

The reverse direction matters as much and is easier to miss. `git diff` and
`git log` read working-tree and history content, and `git add` reads file bytes
into the object store. If Git were file actions, a grant intended to let an
agent inspect and commit its own work would be indistinguishable from a grant to
read and write those files directly — including through `files.read`, on paths
the Git subset would never have exposed. Collapsing the planes widens whichever
one you did not have in mind.

One more thing has to be separated before any of this can be modelled, because
`safe-git.ts` enforces two restrictions that look alike and are not the same
kind of thing.

**Scope** — `validatePathArguments`, which requires every path argument to
resolve inside the approved repository — is authority. It answers "which
repository", it varies per actor and per grant, and it is exactly what a
capability path expresses. It moves into the model unchanged.

**Execution hardening** — the five-subcommand allowlist, the per-subcommand
argument allowlists, `core.hooksPath=/dev/null`, `GIT_CONFIG_NOSYSTEM`,
`GIT_CONFIG_GLOBAL=/dev/null`, `--no-ext-diff`, `--no-textconv`,
`hash-object --no-filters`, symlink refusal — is not authority at all. A
capability names what an actor may do; making hardening a permission would imply
its absence is grantable, and there is nobody to grant it and no request that
should be honoured. It survives for a structural reason instead: the provider is
the only code that can turn a capability into a Git invocation, and it can only
emit the hardened form. That is a property of the code, reviewed as code, and it
holds for every grant that ever matches.

## Decision

**`repo` is a resource namespace of its own, beside `files`.** A repository is
addressed by a path in the same canonical segment vocabulary as any other
resource (ADR 0004), and the two namespaces may name the same directory and
still share no authority, because namespace equality is what `capabilityMatches`
requires before anything else is considered.

The action vocabulary is one action per vetted subcommand:

| Action   | Operation                            |
| -------- | ------------------------------------ |
| `status` | working-tree status                  |
| `diff`   | working-tree or staged diff          |
| `log`    | commit history                       |
| `stage`  | add paths to the index               |
| `commit` | write a commit from the staged index |

No broad `write` action, for ADR 0005's reason: a single write cannot express
"may stage, never commit", and that is precisely the distinction the host being
migrated already makes. `stage` and `commit` are separate because the index and
the history are separate effects — staging is reversible and local, a commit is
the thing another agent pulls.

**The vetted subset is registered as a tool provider, beside the files
provider.** `createRepoTools(provider)` builds `repo.status`, `repo.diff`,
`repo.log`, `repo.stage`, and `repo.commit` over one `ResourceProvider` whose
namespace is `repo`, exactly as `createFileTools` does over a `files` provider,
and `registerStandardOsTools(kernel, { files, repo })` hands both to a kernel.
`safe-git.ts` stays in the local agent: SharedOS ships the vocabulary and the
authorization, never a Git implementation, and nothing here spawns a process.

It is a provider, and specifically not two other things.

- **Not a permission name.** `GitCommit` becomes `repo` / the repository path /
  `commit`. The name of the tool a model calls stops being an input to
  authorization, which is the whole of phase 10; and unlike a name, a
  resource-and-action can say _which_ repository, which `GitCommit` never could.
- **Not an MCP server.** ADR 0014 makes MCP the toolshare boundary — the way
  tools reach SharedOS from outside it. The Git subset is host code in the same
  process as the kernel, so putting it behind a transport would add a hop, a
  serialization, and a second trust boundary to reach code that is already
  trusted, while making the hardening guarantee depend on a server nobody can
  see.

Anything outside the five subcommands — `push`, `reset`, `checkout`, `clean`,
`config`, `remote` — remains `shell.command`, which is never silently granted.
The provider does not widen the reachable set of Git operations; it removes tool
names from the permission vocabulary.

**Nothing in the kernel changed to make room for the second plane.**
`ResourceProviderRegistry` is keyed by namespace and refuses duplicates, and
`SharedOSKernel.registerResourceProvider` never knew which namespace it was
handed. That is worth stating rather than passing over: a kernel that needed a
change to accept a second plane would be a kernel in which `files` was
privileged, and ADR 0005 called files the canonical plane for accumulated
state, not the only namespace that may exist.

**Scope is the capability's path; hardening is not modelled.** A `repo`
capability names the repository and the actions, and the provider confines every
path argument beneath it, as `validatePathArguments` does today. Path arguments
inside a repository — the pathspec of a diff or a stage — are provider input,
not a second resource: staging is authorized at the repository. They are carried
in the same segment vocabulary as any path, so a traversal marker is rejected by
the contract before the provider sees it, but that is a vocabulary constraint
and not the authorization boundary. The boundary is the capability.

## Consequences

### Positive

- Holding file authority over a working tree grants nothing in `repo`, and
  holding `repo` authority grants nothing in `files`. Both directions are pinned
  by tests rather than asserted here.
- A host can issue read-only repository authority — `status`, `diff`, `log` —
  without `stage` or `commit`, and can issue `stage` without `commit`.
- A grant finally says _which repository_, which a tool-name permission could
  not express at all.
- Hardening is reviewed once, as code, instead of appearing in a permission
  vocabulary where its absence would look grantable.
- The plane is optional. A host that registers no `repo` provider has agents for
  which Git does not exist, and no grant can change that.

### Costs

- An agent that edits files and commits them needs two grants. That is the
  point, and it is more work for a host that wanted one.
- Per-file staging authority within a repository is not expressible: `stage` is
  authorized at the repository and the provider confines the pathspec. Finer
  authority would need paths in two planes to resolve in one decision, which is
  the same multi-resource contract ADR 0005 deferred for `move` and `copy`.
- Outputs are unspecified, as they are for `files`. Two hosts may return
  different shapes from `repo.status`.
- The crossing property has unit coverage in `@aicoo/sharedos-os` but no
  conformance row, because the conformance world has no `repo` provider. Adding
  one is follow-up work, and ADR 0013's strict gate means the row lands with the
  provider rather than ahead of it.

## Rejected alternatives

**Model Git as write actions under `files`.** Rejected on the cross-product
above. It is the alternative that motivated this ADR, and its failure is not
aesthetic: it converts every existing file-write grant into a commit grant on
the day it ships.

**Keep the five tool names as permission keys.** Rejected — it is the thing
phase 10 removes. A tool name is a name for one implementation, so the
permission dies when the implementation is replaced or is duplicated when a
second one appears; and a name cannot carry a scope, so `GitCommit` authorizes
committing to every repository the process can reach.

**One `repo` action, `write`.** Rejected for ADR 0005's reason, which applies
here with a sharper example than files had: `stage` and `commit` differ in who
can see the result, and a vocabulary that cannot separate them cannot express
the review arrangement most hosts actually want.

**Name the namespace `files.git`, so it reads as part of the file plane.**
Rejected, and more firmly than it may deserve. Namespace comparison is string
equality, so `files.git` is exactly as separate from `files` as `repo` is — it
merely reads as though it inherits. A name that implies a containment the
predicate does not implement is a trap for the next person to reason about it,
and this is a repository where `sharedos.messaging` and `sharedos.execution` are
already independent planes that share a prefix.

**Model the hardening as capabilities** — an action like `commit:no-verify`, or
a `hooks` resource that nobody is granted. Rejected: it would put in the grant
vocabulary a thing no host may issue and no actor may request, and the first
reader to see an ungranted permission will ask who grants it. Worse, it would
make the guarantee conditional on the grant set rather than on the provider
being the only path to a Git invocation, which is what actually makes it true.

**Expose the subset over MCP as an external server.** Rejected: it would move
in-process host code behind ADR 0014's boundary, which exists for tools that
originate outside SharedOS. It buys nothing — the kernel authorizes the call
either way — and it costs the property that the hardened invocation is the only
one the code can emit, since a server is a thing that can be replaced without
touching this repository.

**A namespace per repository, such as `repo.sharedos`.** Rejected: that is what
the path is for. It would also make the enabled-namespace control plane (ADR 0006) grow a namespace per checkout, so enabling Git at all would require
knowing every repository in advance.
