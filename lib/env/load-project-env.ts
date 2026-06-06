import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export function loadProjectEnv(projectDir = process.cwd()) {
  const envLocalPath = join(projectDir, ".env.local");

  if (!existsSync(envLocalPath)) {
    return;
  }

  const contents = readFileSync(envLocalPath, "utf8");
  const entries = parseEnvFile(contents);

  for (const [key, value] of entries) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function parseEnvFile(contents: string) {
  const entries = new Map<string, string>();

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1).trim();
    const value = stripOptionalQuotes(rawValue);

    if (key) {
      entries.set(key, value);
    }
  }

  return entries;
}

function stripOptionalQuotes(value: string) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}
