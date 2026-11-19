import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const mobile = join(
  dirname(dirname(fileURLToPath(import.meta.url))),
  "apps",
  "mobile",
);
const require = createRequire(join(mobile, "package.json"));
const cli = join(dirname(require.resolve("expo/package.json")), "bin", "cli");
const child = spawn(
  process.execPath,
  [cli, "start", "--dev-client", ...process.argv.slice(2)],
  { cwd: mobile, stdio: "inherit", env: process.env },
);
child.on("error", (error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
