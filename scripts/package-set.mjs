export const npmRegistry = "https://registry.npmjs.org";
export const prereleaseTag = "next";

/**
 * The package set, in publish order.
 *
 * The order is a dependency order: every `@aicoo/sharedos-*` package a package
 * depends on appears before it, so a publish run that stops part-way never
 * leaves a package on the registry ahead of something it needs. `release.mjs`
 * refuses an order that breaks this, and `package-set.test.mjs` checks it
 * against the manifests.
 */
export const packageDirectories = [
  "contracts",
  "core",
  "os",
  "runtime",
  "client",
  "http",
  "testkit",
  "mcp",
  "adapters",
  "conformance",
  "sdk",
];

/**
 * Why `manifests`, in this order, is not a valid publish order.
 *
 * One line per violation: a workspace dependency published later than the
 * package that needs it, or one that is not in the set at all. Development
 * dependencies are not checked, because they never reach the registry.
 */
export function publishOrderViolations(manifests) {
  const position = new Map(manifests.map((manifest, index) => [manifest.name, index]));
  const violations = [];
  manifests.forEach((manifest, index) => {
    const dependencies = [
      ...Object.keys(manifest.dependencies ?? {}),
      ...Object.keys(manifest.peerDependencies ?? {}),
      ...Object.keys(manifest.optionalDependencies ?? {}),
    ];
    for (const dependency of dependencies) {
      if (!dependency.startsWith("@aicoo/sharedos")) continue;
      const dependencyPosition = position.get(dependency);
      if (dependencyPosition === undefined) {
        violations.push(
          `${manifest.name} depends on ${dependency}, which is not in the package set`,
        );
      } else if (dependencyPosition > index) {
        violations.push(`${manifest.name} is published before its dependency ${dependency}`);
      }
    }
  });
  return violations;
}
