import { spawn, execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, delimiter } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const mobile = join(root, "apps", "mobile");
const require = createRequire(join(mobile, "package.json"));
const env = { ...process.env };

// Gradle needs JDK 17 even when the machine's default Java is newer.
if (process.platform === "darwin") {
  try {
    env.JAVA_HOME = execFileSync("/usr/libexec/java_home", ["-v", "17"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    process.stderr.write("Install JDK 17, then retry npm run android.\n");
    process.exit(1);
  }
}

const defaultSdk = join(homedir(), process.platform === "darwin" ? "Library/Android/sdk" : "Android/Sdk");
const sdk = env.ANDROID_HOME || env.ANDROID_SDK_ROOT || defaultSdk;
if (!existsSync(sdk)) {
  process.stderr.write("Android SDK not found. Set ANDROID_HOME to your installed SDK directory.\n");
  process.exit(1);
}
env.ANDROID_HOME = sdk;
env.PATH = [env.JAVA_HOME && join(env.JAVA_HOME, "bin"), join(sdk, "platform-tools"), env.PATH].filter(Boolean).join(delimiter);

let cli;
try {
  cli = join(dirname(require.resolve("expo/package.json")), "bin", "cli");
} catch {
  process.stderr.write("Dependencies missing. Run npm ci in the project root first.\n");
  process.exit(1);
}
process.stdout.write("Building and opening the native Folio app from apps/mobile…\n");
const child = spawn(process.execPath, [cli, "run:android", ...process.argv.slice(2)], {
  cwd: mobile,
  env,
  stdio: "inherit",
});
child.on("error", (error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
child.on("exit", (code) => { process.exitCode = code ?? 1; });
