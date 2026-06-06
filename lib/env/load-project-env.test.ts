import { afterEach, describe, expect, test } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

import { loadProjectEnv } from "./load-project-env";

const TEST_KEY = "CLOUD_ASR_PROVIDER";
const EXISTING_KEY = "DASHSCOPE_API_KEY";

afterEach(() => {
  delete process.env[TEST_KEY];
  delete process.env[EXISTING_KEY];
});

describe("loadProjectEnv", () => {
  test("loads values from .env.local in the project root", () => {
    const projectDir = createTempProject({
      ".env.local": "CLOUD_ASR_PROVIDER=aliyun-funasr\nDASHSCOPE_API_KEY=from-file\n"
    });

    loadProjectEnv(projectDir);

    expect(process.env.CLOUD_ASR_PROVIDER).toBe("aliyun-funasr");
    expect(process.env.DASHSCOPE_API_KEY).toBe("from-file");
  });

  test("does not override environment variables already set in the shell", () => {
    const projectDir = createTempProject({
      ".env.local": "CLOUD_ASR_PROVIDER=aliyun-funasr\nDASHSCOPE_API_KEY=from-file\n"
    });

    process.env.DASHSCOPE_API_KEY = "from-shell";

    loadProjectEnv(projectDir);

    expect(process.env.DASHSCOPE_API_KEY).toBe("from-shell");
  });
});

function createTempProject(files: Record<string, string>) {
    const projectDir = mkdtempSync(join(tmpdir(), "asr-env-test-"));

  for (const [relativePath, contents] of Object.entries(files)) {
    const filePath = join(projectDir, relativePath);
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, contents, "utf8");
  }

  return projectDir;
}
