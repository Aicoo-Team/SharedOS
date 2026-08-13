import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { packageDirectories } from "./package-set.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const checkOnly = process.argv.includes("--check");
const outputDirectory = checkOnly
  ? mkdtempSync(join(tmpdir(), "sharedos-pack-check-"))
  : join(repositoryRoot, "artifacts", "npm");

if (!checkOnly) {
  rmSync(outputDirectory, { recursive: true, force: true });
  mkdirSync(outputDirectory, { recursive: true });
}

try {
  run("pnpm", ["build"], repositoryRoot);

  for (const directory of packageDirectories) {
    run(
      "pnpm",
      ["pack", "--pack-destination", outputDirectory],
      join(repositoryRoot, "packages", directory),
    );
  }

  const archives = readdirSync(outputDirectory)
    .filter((entry) => entry.endsWith(".tgz"))
    .map((entry) => join(outputDirectory, entry))
    .sort();

  if (archives.length !== packageDirectories.length) {
    throw new Error(`Expected ${packageDirectories.length} tarballs, found ${archives.length}.`);
  }

  for (const archive of archives) {
    verifyArchive(archive);
  }

  verifyFreshConsumer(archives);

  if (!checkOnly) {
    console.log("\nInstallable SharedOS preview packages:");
    for (const archive of archives) {
      console.log(`- ${archive}`);
    }
  }
} finally {
  if (checkOnly) {
    rmSync(outputDirectory, { recursive: true, force: true });
  }
}

function verifyArchive(archive) {
  const entries = capture("tar", ["-tf", archive], repositoryRoot).trim().split("\n");
  const manifestText = capture("tar", ["-xOf", archive, "package/package.json"], repositoryRoot);
  const manifest = JSON.parse(manifestText);

  if (manifestText.includes("workspace:")) {
    throw new Error(`${manifest.name} still contains a workspace: dependency.`);
  }
  if (!entries.includes("package/README.md")) {
    throw new Error(`${manifest.name} does not include a package README.`);
  }
  const sourceLicense = join(repositoryRoot, "packages", manifest.name.split("/")[1], "LICENSE");
  if (existsSync(sourceLicense) && !entries.includes("package/LICENSE")) {
    throw new Error(`${manifest.name} does not include its declared license.`);
  }
  if (!entries.includes("package/dist/index.js") || !entries.includes("package/dist/index.d.ts")) {
    throw new Error(`${manifest.name} is missing its runtime or type entry point.`);
  }
  if (!entries.includes("package/src/index.ts")) {
    throw new Error(`${manifest.name} is missing the source referenced by its source maps.`);
  }
  if (entries.some((entry) => entry.includes(".test.") || entry.includes(".tsbuildinfo"))) {
    throw new Error(`${manifest.name} includes test or build-cache files.`);
  }

  for (const version of Object.values(manifest.dependencies ?? {})) {
    if (typeof version === "string" && version.startsWith("workspace:")) {
      throw new Error(`${manifest.name} has an unresolved workspace dependency.`);
    }
  }
}

function verifyFreshConsumer(archives) {
  const consumerDirectory = mkdtempSync(join(tmpdir(), "sharedos-consumer-"));
  try {
    writeFileSync(
      join(consumerDirectory, "package.json"),
      `${JSON.stringify({ name: "sharedos-pack-smoke", private: true, type: "module" }, null, 2)}\n`,
    );
    run(
      "npm",
      ["install", "--ignore-scripts", "--no-audit", "--no-fund", ...archives],
      consumerDirectory,
    );

    writeFileSync(
      join(consumerDirectory, "smoke.mjs"),
      [
        'import { AccessContextSchema, CapabilityAuthorizer, SharedOSClient, SharedOSKernel, TurnExecutor } from "@sharedos/sdk";',
        'import { createTestContext } from "@sharedos/testkit";',
        "",
        "const values = [AccessContextSchema, CapabilityAuthorizer, SharedOSClient, SharedOSKernel, TurnExecutor, createTestContext];",
        'if (values.some((value) => value === undefined)) throw new Error("SharedOS export missing");',
        'console.log("SharedOS fresh-consumer runtime import passed.");',
        "",
      ].join("\n"),
    );
    run("node", ["smoke.mjs"], consumerDirectory);

    writeFileSync(
      join(consumerDirectory, "smoke.ts"),
      [
        'import { SharedOSKernel, type AccessContext } from "@sharedos/sdk";',
        'import { createTestContext } from "@sharedos/testkit";',
        "",
        "const kernel: SharedOSKernel = new SharedOSKernel();",
        "const context: AccessContext = createTestContext();",
        "void kernel;",
        "void context;",
        "",
      ].join("\n"),
    );
    writeFileSync(
      join(consumerDirectory, "tsconfig.json"),
      `${JSON.stringify(
        {
          compilerOptions: {
            strict: true,
            noEmit: true,
            target: "ES2022",
            lib: ["ES2022", "DOM", "DOM.Iterable"],
            module: "NodeNext",
            moduleResolution: "NodeNext",
            skipLibCheck: false,
          },
          include: ["smoke.ts"],
        },
        null,
        2,
      )}\n`,
    );
    run(
      join(repositoryRoot, "node_modules", ".bin", "tsc"),
      ["--project", join(consumerDirectory, "tsconfig.json"), "--pretty", "false"],
      consumerDirectory,
    );
  } finally {
    rmSync(consumerDirectory, { recursive: true, force: true });
  }
}

function run(command, arguments_, cwd) {
  execFileSync(command, arguments_, { cwd, stdio: "inherit" });
}

function capture(command, arguments_, cwd) {
  return execFileSync(command, arguments_, { cwd, encoding: "utf8" });
}
