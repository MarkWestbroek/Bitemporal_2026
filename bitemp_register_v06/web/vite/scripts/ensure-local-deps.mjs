import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(scriptDir, "..");
const nodeModulesDir = path.join(projectDir, "node_modules");
const stampFile = path.join(nodeModulesDir, ".platform-stamp.json");

const currentPlatform = {
  platform: process.platform,
  arch: process.arch,
  npm_config_user_agent: process.env.npm_config_user_agent || "",
};

function readStamp() {
  if (!fs.existsSync(stampFile)) return null;
  try {
    return JSON.parse(fs.readFileSync(stampFile, "utf8"));
  } catch {
    return null;
  }
}

function writeStamp() {
  fs.mkdirSync(nodeModulesDir, { recursive: true });
  fs.writeFileSync(stampFile, `${JSON.stringify(currentPlatform, null, 2)}\n`, "utf8");
}

function viteBinaryExists() {
  return fs.existsSync(path.join(nodeModulesDir, ".bin", process.platform === "win32" ? "vite.cmd" : "vite"));
}

function stampMatches(stamp) {
  return (
    stamp &&
    stamp.platform === currentPlatform.platform &&
    stamp.arch === currentPlatform.arch
  );
}

function runInstall() {
  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
  console.log(`[deps] Installeer frontend dependencies voor ${os.platform()}-${os.arch()}...`);
  const result = spawnSync(npmCmd, ["install"], {
    cwd: projectDir,
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
  writeStamp();
}

const stamp = readStamp();
const needsInstall = !viteBinaryExists() || !stampMatches(stamp);

if (needsInstall) {
  runInstall();
} else {
  writeStamp();
}