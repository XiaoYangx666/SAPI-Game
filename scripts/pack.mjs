import { mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const outputDir = resolve(root, "artifacts");
const workspaces = [
    "@begame/core",
    "@begame/test",
    "@begame/trace-tools",
];

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

console.log(`Packed ${workspaces.length} BEGame packages to ${outputDir}`);
