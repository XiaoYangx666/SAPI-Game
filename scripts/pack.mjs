import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const outputDir = resolve(root, "artifacts");

/**
 * Derived from the workspace manifests rather than hand-listed.
 *
 * A hand-maintained list silently omits any package added later, and
 * `npm run pack` still exits successfully, so the omission only shows up when
 * someone tries to install a tarball that was never produced.
 */
const packagesDir = resolve(root, "packages");
const workspaces = readdirSync(packagesDir)
    .map((entry) => resolve(packagesDir, entry, "package.json"))
    .filter((manifest) => existsSync(manifest))
    .map((manifest) => JSON.parse(readFileSync(manifest, "utf8")))
    .filter((pkg) => pkg.private !== true)
    .map((pkg) => pkg.name)
    .sort();

if (workspaces.length === 0) {
    console.error("No publishable packages found under packages/");
    process.exit(1);
}

function runNpm(args) {
    const npmExecPath = process.env.npm_execpath;
    const result = npmExecPath
        ? spawnSync(process.execPath, [npmExecPath, ...args], {
              cwd: root,
              stdio: "inherit",
          })
        : spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", args, {
              cwd: root,
              stdio: "inherit",
          });

    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status ?? 1);
}

rmSync(outputDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });

runNpm(["run", "build"]);

for (const workspace of workspaces) {
    runNpm([
        "pack",
        "--workspace",
        workspace,
        "--pack-destination",
        outputDir,
    ]);
}

console.log(
    `Packed ${workspaces.length} BEGame packages to ${outputDir}: ${workspaces.join(", ")}`
);
