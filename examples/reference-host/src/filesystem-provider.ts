/**
 * A filesystem-backed SharedOS `files` provider.
 *
 * This is the piece SharedOS deliberately does not ship: the host owns storage.
 * It implements all twelve canonical actions over one root directory, per
 * (namespaceId, owner) tenant, with path canonicalisation, symlink-escape
 * rejection, content-hash version checks, and snapshots.
 */
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { access, mkdir, readdir, readFile, realpath, rm, stat, writeFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";

import type {
  Address,
  JsonObject,
  JsonValue,
  ResourceOperation,
  ResourceResult,
} from "@aicoo/sharedos-contracts";
import type { ResourceProvider } from "@aicoo/sharedos-core";

const SNAPSHOT_DIR = ".sharedos-snapshots";

export interface FilesystemResourceProviderOptions {
  /** Absolute path of the directory this provider may never escape. */
  readonly root: string;
  /** Bytes above which `read` truncates instead of returning the whole file. */
  readonly maxReadBytes?: number;
}

export class FilesystemResourceProvider implements ResourceProvider {
  readonly namespace = "files";
  readonly #root: string;
  readonly #maxReadBytes: number;

  constructor(options: FilesystemResourceProviderOptions) {
    this.#root = resolve(options.root);
    this.#maxReadBytes = options.maxReadBytes ?? 256 * 1024;
  }

  async invoke(operation: ResourceOperation, signal: AbortSignal): Promise<ResourceResult> {
    signal.throwIfAborted();
    const started = new Date().toISOString();

    try {
      const tenant = await this.#tenantRoot(operation);
      const target = await this.#safeResolve(tenant, operation.resource.path);
      const input = (operation.input ?? {}) as JsonObject;
      const output = await this.#dispatch(operation.action, target, tenant, input, signal);
      signal.throwIfAborted();
      return {
        operationId: operation.operationId,
        completedAt: started,
        status: "succeeded",
        output,
      };
    } catch (error) {
      if (signal.aborted) throw error;
      const failure = asFailure(error);
      return {
        operationId: operation.operationId,
        completedAt: new Date().toISOString(),
        status: failure.status,
        error: { code: failure.code, message: failure.message, retryable: false },
      };
    }
  }

  async #dispatch(
    action: string,
    target: ResolvedPath,
    tenant: string,
    input: JsonObject,
    signal: AbortSignal,
  ): Promise<JsonValue> {
    switch (action) {
      case "list":
        return this.#list(target);
      case "stat":
        return this.#stat(target);
      case "read":
        return this.#read(target);
      case "search":
        return this.#search(target, String(input.query ?? ""), numberOr(input.limit, 20));
      case "grep":
        return this.#grep(target, String(input.pattern ?? ""), input);
      case "create":
        return this.#write(target, input, signal, { mustNotExist: true });
      case "replace":
        return this.#write(target, input, signal, { mustNotExist: false });
      case "append":
        return this.#append(target, input, signal);
      case "delete":
        return this.#delete(target, input, signal);
      case "snapshot:create":
        return this.#snapshotCreate(target, tenant, input, signal);
      case "snapshot:list":
        return this.#snapshotList(target, tenant);
      case "snapshot:restore":
        return this.#snapshotRestore(target, tenant, input, signal);
      default:
        throw new ProviderError(
          "unsupported_action",
          `files provider cannot perform ${action}`,
          "failed",
        );
    }
  }

  // ---- reads -------------------------------------------------------------

  async #list(target: ResolvedPath): Promise<JsonValue> {
    const entries = await readdir(target.absolute, { withFileTypes: true });
    return {
      path: target.segments,
      entries: entries
        .filter((entry) => entry.name !== SNAPSHOT_DIR)
        .map((entry) => ({ name: entry.name, kind: entry.isDirectory() ? "directory" : "file" })),
    };
  }

  async #stat(target: ResolvedPath): Promise<JsonValue> {
    const info = await stat(target.absolute);
    const version = info.isFile() ? await this.#version(target.absolute) : undefined;
    return {
      path: target.segments,
      kind: info.isDirectory() ? "directory" : "file",
      sizeBytes: info.size,
      modifiedAt: info.mtime.toISOString(),
      ...(version === undefined ? {} : { version }),
    };
  }

  async #read(target: ResolvedPath): Promise<JsonValue> {
    const info = await stat(target.absolute);
    if (info.isDirectory()) {
      throw new ProviderError("not_a_file", "read targets a directory", "failed");
    }
    const raw = await readFile(target.absolute, "utf8");
    const truncated = raw.length > this.#maxReadBytes;
    return {
      path: target.segments,
      version: hash(raw),
      truncated,
      content: truncated ? raw.slice(0, this.#maxReadBytes) : raw,
    };
  }

  async #search(target: ResolvedPath, query: string, limit: number): Promise<JsonValue> {
    if (query.length === 0)
      throw new ProviderError("invalid_input", "search needs a query", "failed");
    const terms = query.toLowerCase().split(/\s+/u).filter(Boolean);
    const hits: Array<{ path: string[]; score: number; excerpt: string }> = [];

    for await (const file of this.#walk(target)) {
      const text = await readFile(file.absolute, "utf8").catch(() => "");
      const haystack = text.toLowerCase();
      const score = terms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0);
      if (score === 0) continue;
      const anchor = haystack.indexOf(terms[0] ?? "");
      hits.push({
        path: file.segments,
        score: score / terms.length,
        excerpt: text.slice(Math.max(0, anchor - 80), Math.max(0, anchor - 80) + 240).trim(),
      });
    }

    hits.sort((left, right) => right.score - left.score);
    return { path: target.segments, hits: hits.slice(0, limit) };
  }

  async #grep(target: ResolvedPath, pattern: string, input: JsonObject): Promise<JsonValue> {
    if (pattern.length === 0)
      throw new ProviderError("invalid_input", "grep needs a pattern", "failed");
    const caseSensitive = input.caseSensitive === true;
    const matcher =
      input.mode === "regex"
        ? new RegExp(pattern, caseSensitive ? "u" : "iu")
        : {
            test: (line: string) =>
              (caseSensitive ? line : line.toLowerCase()).includes(
                caseSensitive ? pattern : pattern.toLowerCase(),
              ),
          };

    const before = numberOr(input.contextBefore, 0);
    const after = numberOr(input.contextAfter, 0);
    const matches: Array<JsonValue> = [];

    for await (const file of this.#walk(target)) {
      const lines = (await readFile(file.absolute, "utf8").catch(() => "")).split("\n");
      lines.forEach((line, index) => {
        if (!matcher.test(line)) return;
        matches.push({
          path: file.segments,
          line: index + 1,
          text: line,
          context: lines.slice(Math.max(0, index - before), index + after + 1),
        });
      });
    }

    return { path: target.segments, matches };
  }

  // ---- mutations ---------------------------------------------------------

  async #write(
    target: ResolvedPath,
    input: JsonObject,
    signal: AbortSignal,
    options: { mustNotExist: boolean },
  ): Promise<JsonValue> {
    const exists = await pathExists(target.absolute);
    if (options.mustNotExist && exists) {
      throw new ProviderError("already_exists", "create targets an existing file", "failed");
    }
    if (!options.mustNotExist) {
      await this.#assertVersion(target.absolute, input.expectedVersion);
    }

    const content = contentToText(input.content);
    signal.throwIfAborted();
    await mkdir(join(target.absolute, ".."), { recursive: true });
    await writeFile(target.absolute, content, "utf8");
    return { path: target.segments, version: hash(content), bytes: Buffer.byteLength(content) };
  }

  async #append(target: ResolvedPath, input: JsonObject, signal: AbortSignal): Promise<JsonValue> {
    const existing = (await readFile(target.absolute, "utf8").catch(() => "")) as string;
    await this.#assertVersion(target.absolute, input.expectedVersion);
    const next = existing + contentToText(input.content);
    signal.throwIfAborted();
    await mkdir(join(target.absolute, ".."), { recursive: true });
    await writeFile(target.absolute, next, "utf8");
    return { path: target.segments, version: hash(next), bytes: Buffer.byteLength(next) };
  }

  async #delete(target: ResolvedPath, input: JsonObject, signal: AbortSignal): Promise<JsonValue> {
    await this.#assertVersion(target.absolute, input.expectedVersion);
    const info = await stat(target.absolute);
    if (info.isDirectory() && input.recursive !== true) {
      throw new ProviderError("not_empty", "delete on a directory requires recursive", "failed");
    }
    signal.throwIfAborted();
    await rm(target.absolute, { recursive: input.recursive === true, force: false });
    return { path: target.segments, deleted: true };
  }

  // ---- snapshots ---------------------------------------------------------

  async #snapshotCreate(
    target: ResolvedPath,
    tenant: string,
    input: JsonObject,
    signal: AbortSignal,
  ): Promise<JsonValue> {
    const content = await readFile(target.absolute, "utf8");
    const snapshotId = `${Date.now().toString(36)}-${hash(content).slice(0, 8)}`;
    const directory = join(tenant, SNAPSHOT_DIR, ...target.segments);
    signal.throwIfAborted();
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, `${snapshotId}.snapshot`), content, "utf8");
    return { path: target.segments, snapshotId, label: input.label ?? null };
  }

  async #snapshotList(target: ResolvedPath, tenant: string): Promise<JsonValue> {
    const directory = join(tenant, SNAPSHOT_DIR, ...target.segments);
    const files = await readdir(directory).catch(() => [] as string[]);
    return {
      path: target.segments,
      snapshots: files
        .filter((name) => name.endsWith(".snapshot"))
        .map((name) => ({ snapshotId: name.replace(/\.snapshot$/u, "") }))
        .sort((left, right) => right.snapshotId.localeCompare(left.snapshotId)),
    };
  }

  async #snapshotRestore(
    target: ResolvedPath,
    tenant: string,
    input: JsonObject,
    signal: AbortSignal,
  ): Promise<JsonValue> {
    const snapshotId = String(input.snapshotId ?? "");
    if (!/^[A-Za-z0-9-]{1,128}$/u.test(snapshotId)) {
      throw new ProviderError("invalid_input", "snapshotId is malformed", "failed");
    }
    await this.#assertVersion(target.absolute, input.expectedVersion);
    const source = join(tenant, SNAPSHOT_DIR, ...target.segments, `${snapshotId}.snapshot`);
    const content = await readFile(source, "utf8");
    signal.throwIfAborted();
    await writeFile(target.absolute, content, "utf8");
    return { path: target.segments, snapshotId, version: hash(content) };
  }

  // ---- path safety -------------------------------------------------------

  /** One directory per (namespace, owner). Cross-tenant reads cannot share a prefix. */
  async #tenantRoot(operation: ResourceOperation): Promise<string> {
    const owner = operation.resource.owner ?? operation.context.owner;
    const directory = join(
      this.#root,
      safeSegment(operation.context.namespaceId),
      safeSegment(addressKey(owner)),
    );
    await mkdir(directory, { recursive: true });
    return await realpath(directory);
  }

  /**
   * Contracts already reject separators and traversal markers in segments, so
   * the remaining risk is a link planted inside the tree.
   *
   * Staying under the tenant root is NOT sufficient. Authorization is decided
   * on the logical path, but the provider serves the physical target, so a
   * symlink that stays inside the tenant and points at a *different granted
   * subtree* voids the grant silently. Require the resolved path to equal the
   * literal path, which rejects a link anywhere along it.
   */
  async #safeResolve(tenant: string, segments: readonly string[]): Promise<ResolvedPath> {
    for (const segment of segments) {
      if (segment.includes("/") || segment.includes("\\") || segment === "." || segment === "..") {
        throw new ProviderError("invalid_path", "path segment is not canonical", "denied");
      }
    }

    const absolute = join(tenant, ...segments);
    const anchor = await nearestExisting(absolute);
    const real = await realpath(anchor);

    if (real !== tenant && !real.startsWith(tenant + sep)) {
      throw new ProviderError("path_escape", "resolved path leaves the tenant root", "denied");
    }
    if (real !== anchor) {
      throw new ProviderError("path_escape", "path resolves through a link", "denied");
    }
    return { absolute, segments: [...segments] };
  }

  async *#walk(target: ResolvedPath): AsyncGenerator<ResolvedPath> {
    const info = await stat(target.absolute).catch(() => undefined);
    if (info === undefined) return;
    if (info.isFile()) {
      yield target;
      return;
    }
    for (const entry of await readdir(target.absolute, { withFileTypes: true })) {
      if (entry.name === SNAPSHOT_DIR || entry.isSymbolicLink()) continue;
      yield* this.#walk({
        absolute: join(target.absolute, entry.name),
        segments: [...target.segments, entry.name],
      });
    }
  }

  async #version(absolute: string): Promise<string> {
    return hash(await readFile(absolute, "utf8"));
  }

  async #assertVersion(absolute: string, expected: JsonValue | undefined): Promise<void> {
    if (expected === undefined || expected === null) return;
    const current = await this.#version(absolute).catch(() => undefined);
    if (current !== expected) {
      throw new ProviderError(
        "version_conflict",
        "expectedVersion does not match stored content",
        "failed",
      );
    }
  }
}

interface ResolvedPath {
  readonly absolute: string;
  readonly segments: string[];
}

class ProviderError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: "denied" | "failed",
  ) {
    super(message);
  }
}

function asFailure(error: unknown): { code: string; message: string; status: "denied" | "failed" } {
  if (error instanceof ProviderError)
    return { code: error.code, message: error.message, status: error.status };
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  if (code === "ENOENT")
    return { code: "not_found", message: "path does not exist", status: "failed" };
  if (code === "EACCES")
    return { code: "not_permitted", message: "filesystem refused the operation", status: "denied" };
  return {
    code: "provider_error",
    message: error instanceof Error ? error.message : "unknown error",
    status: "failed",
  };
}

async function nearestExisting(absolute: string): Promise<string> {
  let candidate = absolute;
  while (!(await pathExists(candidate))) {
    const parent = resolve(candidate, "..");
    if (parent === candidate) return parent;
    candidate = parent;
  }
  return candidate;
}

async function pathExists(absolute: string): Promise<boolean> {
  return await access(absolute, constants.F_OK).then(
    () => true,
    () => false,
  );
}

function addressKey(address: Address): string {
  switch (address.kind) {
    case "human":
      return `human-${address.userId}`;
    case "agent":
      return `agent-${address.agentId}`;
    case "group":
      return `group-${address.conversationId}`;
    case "service":
      return `service-${address.serviceId}`;
  }
}

function safeSegment(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]/gu, "_");
}

function contentToText(content: JsonValue | undefined): string {
  if (typeof content === "string") return content;
  return JSON.stringify(content ?? null);
}

function numberOr(value: JsonValue | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function hash(content: string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 32);
}
