import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(scriptDir, "..");
const nodeModulesDir = path.join(projectDir, "node_modules");
const stampFile = path.join(nodeModulesDir, ".platform-stamp.json");
const packageJsonFile = path.join(projectDir, "package.json");

const packageJson = JSON.parse(fs.readFileSync(packageJsonFile, "utf8"));
const declaredPackageNames = [
  ...Object.keys(packageJson.dependencies || {}),
  ...Object.keys(packageJson.devDependencies || {}),
];

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

function packageExists(packageName) {
  const packageDir = path.join(nodeModulesDir, ...packageName.split("/"));
  const packageJsonPath = path.join(packageDir, "package.json");
  return fs.existsSync(packageJsonPath);
}

function findMissingPackages() {
  return declaredPackageNames.filter((packageName) => !packageExists(packageName));
}

function stampMatches(stamp) {
  return (
    stamp &&
    stamp.platform === currentPlatform.platform &&
    stamp.arch === currentPlatform.arch
  );
}

function buildInstallEnv() {
  // VS Code JS auto-attach kan debug-variabelen doorgeven aan child processes.
  // Daardoor kan `npm install` bij `npm run dev` blijven hangen op
  // "Debugger attached" / "Waiting for the debugger to disconnect...".
  // Voor deze dependency-bootstrap willen we die lokale debug-state expliciet niet erven.
  const env = { ...process.env };
  const strippedKeys = [
    "NODE_OPTIONS",
    "VSCODE_INSPECTOR_OPTIONS",
    "npm_config_node_options",
    "NODE_INSPECT_RESUME_ON_START",
  ].filter((key) => env[key]);

  for (const key of strippedKeys) {
    delete env[key];
  }

  if (strippedKeys.length > 0) {
    console.log(`[deps] Debug-variabelen tijdelijk uitgezet voor npm install: ${strippedKeys.join(", ")}`);
  }

  return env;
}

function resolveInstallCommand() {
  // Als dit script via `npm run ...` gestart is, hergebruik dan dezelfde npm CLI.
  // Dat vermijdt Windows-problemen met `spawnSync('npm.cmd', ...)` (EINVAL).
  if (process.env.npm_execpath) {
    return {
      command: process.execPath,
      args: [process.env.npm_execpath, "install"],
    };
  }

  if (process.platform === "win32") {
    return {
      command: process.env.ComSpec || "cmd.exe",
      args: ["/d", "/s", "/c", "npm.cmd install"],
    };
  }

  return {
    command: "npm",
    args: ["install"],
  };
}

function runInstall() {
  const { command, args } = resolveInstallCommand();
  console.log(`[deps] Installeer frontend dependencies voor ${os.platform()}-${os.arch()}...`);
  const result = spawnSync(command, args, {
    cwd: projectDir,
    stdio: "inherit",
    env: buildInstallEnv(),
  });
  if (result.error) {
    console.error(`[deps] Kon npm install niet starten: ${result.error.message}`);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
  writeStamp();
}

const stamp = readStamp();
const missingPackages = findMissingPackages();
const needsInstall = !viteBinaryExists() || !stampMatches(stamp) || missingPackages.length > 0;

if (needsInstall) {
  if (missingPackages.length > 0) {
    console.log(`[deps] Ontbrekende npm packages gevonden: ${missingPackages.join(", ")}`);
  }
  runInstall();
} else {
  writeStamp();
}