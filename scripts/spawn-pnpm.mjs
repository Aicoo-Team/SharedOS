import { spawnSync } from "node:child_process";

export function spawnPnpmSync(args, options) {
  if (process.platform === "win32") {
    return spawnSync(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", "pnpm.cmd", ...args], {
      ...options,
      windowsHide: true,
    });
  }

  return spawnSync("pnpm", args, options);
}
