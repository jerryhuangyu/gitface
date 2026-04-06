import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import simpleGit from "simple-git";
import { describe, expect, test } from "vitest";
import { useProfileCommand } from "../src/commands/index";
import { runUseAction } from "../src/commands/use/action";
import { ProfileService } from "../src/core/profile-service";
import { runCli, safeRemove, spyConsole, stripAnsi } from "./helpers/e2e";

function setStdoutTTY(value: boolean): () => void {
  const hadOwn = Object.hasOwn(process.stdout, "isTTY");
  const previous = (process.stdout as { isTTY?: boolean }).isTTY;

  Object.defineProperty(process.stdout, "isTTY", {
    value,
    configurable: true,
  });

  return () => {
    if (hadOwn) {
      Object.defineProperty(process.stdout, "isTTY", {
        value: previous,
        configurable: true,
      });
      return;
    }
    delete (process.stdout as { isTTY?: boolean }).isTTY;
  };
}

describe("use command e2e", () => {
  test("applies profile and overrides with another profile to local git config in a repo", async () => {
    const originalXdg = process.env.XDG_CONFIG_HOME;
    const originalArgv = process.argv.slice();
    const originalExitCode = process.exitCode;
    const originalCwd = process.cwd();
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gitface-use-"));
    const repoDir = path.join(tmpRoot, "repo");
    const configDir = path.join(tmpRoot, "config");
    const logs: string[] = [];
    const restoreLog = spyConsole(logs);

    await fs.mkdir(repoDir);
    const git = simpleGit({ baseDir: repoDir });
    await git.init();

    try {
      process.chdir(repoDir);
      process.env.XDG_CONFIG_HOME = configDir;

      const service = ProfileService.create();
      await service.createProfile({
        name: "work",
        gitName: "Work User",
        email: "work@example.com",
        signingKey: "WORKKEY",
      });
      await service.createProfile({
        name: "personal",
        gitName: "Personal User",
        email: "me@example.com",
      });

      await runCli([useProfileCommand.command], ["node", "gitface", "use", "work"]);
      const afterWork = await git.listConfig();
      expect(afterWork.all["user.name"]).toBe("Work User");
      expect(afterWork.all["user.email"]).toBe("work@example.com");
      expect(afterWork.all["user.signingkey"]).toBe("WORKKEY");
      expect(stripAnsi(logs.join("\n"))).toMatch(/Used profile 'work'/i);
      logs.length = 0;

      await runCli([useProfileCommand.command], ["node", "gitface", "use", "personal"]);
      const afterPersonal = await git.listConfig();
      expect(afterPersonal.all["user.name"]).toBe("Personal User");
      expect(afterPersonal.all["user.email"]).toBe("me@example.com");
      expect(afterPersonal.all["user.signingkey"]).toBeUndefined();
      expect(stripAnsi(logs.join("\n"))).toMatch(/Used profile 'personal'/i);
    } finally {
      process.chdir(originalCwd);
      process.argv = originalArgv;
      if (originalXdg === undefined) {
        delete process.env.XDG_CONFIG_HOME;
      } else {
        process.env.XDG_CONFIG_HOME = originalXdg;
      }
      process.exitCode = originalExitCode;
      restoreLog();
      await safeRemove(tmpRoot);
    }
  });

  test("sets exit code when profile is missing and leaves config untouched", async () => {
    const originalXdg = process.env.XDG_CONFIG_HOME;
    const originalArgv = process.argv.slice();
    const originalExitCode = process.exitCode;
    const originalCwd = process.cwd();
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gitface-use-"));
    const repoDir = path.join(tmpRoot, "repo");
    const configDir = path.join(tmpRoot, "config");
    const logs: string[] = [];
    const restoreLog = spyConsole(logs);

    await fs.mkdir(repoDir);
    const git = simpleGit({ baseDir: repoDir });
    await git.init();

    try {
      process.chdir(repoDir);
      process.env.XDG_CONFIG_HOME = configDir;
      process.exitCode = undefined;
      const service = ProfileService.create();
      await service.createProfile({
        name: "work",
        gitName: "Work User",
        email: "work@example.com",
      });

      await runCli([useProfileCommand.command], ["node", "gitface", "use", "missing"]);

      const gitConfig = await fs.readFile(path.join(repoDir, ".git", "config"), "utf8");
      expect(gitConfig.includes("user.name")).toBe(false);
      expect(gitConfig.includes("user.email")).toBe(false);
      expect(process.exitCode).toBe(1);
      const output = stripAnsi(logs.join("\n"));
      expect(output.toLowerCase()).toContain("profile");
      expect(output).toContain("Did you mean");
      expect(output).toContain("'work'");
    } finally {
      process.chdir(originalCwd);
      process.argv = originalArgv;
      if (originalXdg === undefined) {
        delete process.env.XDG_CONFIG_HOME;
      } else {
        process.env.XDG_CONFIG_HOME = originalXdg;
      }
      process.exitCode = originalExitCode;
      restoreLog();
      await safeRemove(tmpRoot);
    }
  });

  test("emits JSON output when applying a profile with --json", async () => {
    const originalXdg = process.env.XDG_CONFIG_HOME;
    const originalArgv = process.argv.slice();
    const originalExitCode = process.exitCode;
    const originalCwd = process.cwd();
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gitface-use-"));
    const repoDir = path.join(tmpRoot, "repo");
    const configDir = path.join(tmpRoot, "config");
    const logs: string[] = [];
    const restoreLog = spyConsole(logs);

    await fs.mkdir(repoDir);
    const git = simpleGit({ baseDir: repoDir });
    await git.init();

    try {
      process.chdir(repoDir);
      process.env.XDG_CONFIG_HOME = configDir;

      const service = ProfileService.create();
      await service.createProfile({
        name: "work",
        gitName: "Work User",
        email: "work@example.com",
      });

      await runCli([useProfileCommand.command], ["node", "gitface", "use", "work", "--json"]);

      const parsed = JSON.parse(stripAnsi(logs.join("\n"))) as Record<string, unknown>;
      expect(parsed).toMatchObject({
        status: "applied",
        name: "work",
        gitName: "Work User",
        email: "work@example.com",
        signingKey: null,
        scope: "local",
        hasChanges: true,
      });
      expect(parsed.changes).toMatchObject([
        {
          key: "user.name",
          action: "set",
          after: "Work User",
        },
        {
          key: "user.email",
          action: "set",
          after: "work@example.com",
        },
      ]);

      const config = await git.listConfig();
      expect(config.all["user.name"]).toBe("Work User");
      expect(config.all["user.email"]).toBe("work@example.com");
    } finally {
      process.chdir(originalCwd);
      process.argv = originalArgv;
      if (originalXdg === undefined) {
        delete process.env.XDG_CONFIG_HOME;
      } else {
        process.env.XDG_CONFIG_HOME = originalXdg;
      }
      process.exitCode = originalExitCode;
      restoreLog();
      await safeRemove(tmpRoot);
    }
  });

  test("emits Result Envelope output when applying a profile with --json-envelope", async () => {
    const originalXdg = process.env.XDG_CONFIG_HOME;
    const originalArgv = process.argv.slice();
    const originalExitCode = process.exitCode;
    const originalCwd = process.cwd();
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gitface-use-"));
    const repoDir = path.join(tmpRoot, "repo");
    const configDir = path.join(tmpRoot, "config");
    const logs: string[] = [];
    const restoreLog = spyConsole(logs);

    await fs.mkdir(repoDir);
    const git = simpleGit({ baseDir: repoDir });
    await git.init();

    try {
      process.chdir(repoDir);
      process.env.XDG_CONFIG_HOME = configDir;

      const service = ProfileService.create();
      await service.createProfile({
        name: "work",
        gitName: "Work User",
        email: "work@example.com",
      });

      await runCli(
        [useProfileCommand.command],
        ["node", "gitface", "use", "work", "--json-envelope"],
      );

      const parsed = JSON.parse(stripAnsi(logs.join("\n"))) as Record<string, unknown>;
      expect(parsed.status).toBe("success");
      expect(parsed.code).toBe("USE_PROFILE_APPLIED");
      expect(parsed.message).toBe("Profile applied to Git config.");
      expect(parsed.errors).toEqual([]);
      expect(parsed.meta).toMatchObject({
        schemaVersion: "1.0.0",
      });

      const data = parsed.data as Record<string, unknown>;
      expect(data).toMatchObject({
        result: "applied",
        scope: "local",
        hasChanges: true,
        profile: {
          name: "work",
          gitName: "Work User",
          email: "work@example.com",
          signingKey: null,
        },
      });
      expect(Array.isArray(data.changes)).toBe(true);

      const config = await git.listConfig();
      expect(config.all["user.name"]).toBe("Work User");
      expect(config.all["user.email"]).toBe("work@example.com");
    } finally {
      process.chdir(originalCwd);
      process.argv = originalArgv;
      if (originalXdg === undefined) {
        delete process.env.XDG_CONFIG_HOME;
      } else {
        process.env.XDG_CONFIG_HOME = originalXdg;
      }
      process.exitCode = originalExitCode;
      restoreLog();
      await safeRemove(tmpRoot);
    }
  });

  test("emits Result Envelope output when applying a profile with --json-envelope", async () => {
    const originalXdg = process.env.XDG_CONFIG_HOME;
    const originalArgv = process.argv.slice();
    const originalExitCode = process.exitCode;
    const originalCwd = process.cwd();
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gitface-use-"));
    const repoDir = path.join(tmpRoot, "repo");
    const configDir = path.join(tmpRoot, "config");
    const logs: string[] = [];
    const restoreLog = spyConsole(logs);

    await fs.mkdir(repoDir);
    const git = simpleGit({ baseDir: repoDir });
    await git.init();

    try {
      process.chdir(repoDir);
      process.env.XDG_CONFIG_HOME = configDir;

      const service = ProfileService.create();
      await service.createProfile({
        name: "work",
        gitName: "Work User",
        email: "work@example.com",
      });

      await runCli(
        [useProfileCommand.command],
        ["node", "gitface", "use", "work", "--json-envelope"],
      );

      const parsed = JSON.parse(stripAnsi(logs.join("\n"))) as {
        status: string;
        code: string;
        data: {
          result: string;
          scope: string;
          profile: { name: string };
          hasChanges: boolean;
          changes: Array<{ key: string; action: string }>;
        };
        meta: { schemaVersion: string; durationMs: number; traceId: string };
        errors: unknown[];
      };
      expect(parsed.status).toBe("success");
      expect(parsed.code).toBe("USE_PROFILE_APPLIED");
      expect(parsed.data.result).toBe("applied");
      expect(parsed.data.scope).toBe("local");
      expect(parsed.data.profile.name).toBe("work");
      expect(parsed.data.hasChanges).toBe(true);
      expect(parsed.data.changes).toMatchObject([
        { key: "user.name", action: "set" },
        { key: "user.email", action: "set" },
      ]);
      expect(parsed.errors).toEqual([]);
      expect(parsed.meta.schemaVersion).toBe("1.0.0");
      expect(parsed.meta.durationMs).toBeTypeOf("number");
      expect(parsed.meta.traceId.length).toBeGreaterThan(0);

      const config = await git.listConfig();
      expect(config.all["user.name"]).toBe("Work User");
      expect(config.all["user.email"]).toBe("work@example.com");
    } finally {
      process.chdir(originalCwd);
      process.argv = originalArgv;
      if (originalXdg === undefined) {
        delete process.env.XDG_CONFIG_HOME;
      } else {
        process.env.XDG_CONFIG_HOME = originalXdg;
      }
      process.exitCode = originalExitCode;
      restoreLog();
      await safeRemove(tmpRoot);
    }
  });

  test("emits JSON output when --query resolves to a single profile", async () => {
    const originalXdg = process.env.XDG_CONFIG_HOME;
    const originalArgv = process.argv.slice();
    const originalExitCode = process.exitCode;
    const originalCwd = process.cwd();
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gitface-use-"));
    const repoDir = path.join(tmpRoot, "repo");
    const configDir = path.join(tmpRoot, "config");
    const logs: string[] = [];
    const restoreLog = spyConsole(logs);

    await fs.mkdir(repoDir);
    const git = simpleGit({ baseDir: repoDir });
    await git.init();

    try {
      process.chdir(repoDir);
      process.env.XDG_CONFIG_HOME = configDir;

      const service = ProfileService.create();
      await service.createProfile({
        name: "work-main",
        gitName: "Work User",
        email: "work@example.com",
      });
      await service.createProfile({
        name: "personal",
        gitName: "Personal User",
        email: "personal@example.com",
      });

      await runCli(
        [useProfileCommand.command],
        ["node", "gitface", "use", "--query", "work", "--json"],
      );

      const parsed = JSON.parse(stripAnsi(logs.join("\n"))) as Record<string, unknown>;
      expect(parsed).toMatchObject({
        status: "applied",
        name: "work-main",
        gitName: "Work User",
        email: "work@example.com",
        signingKey: null,
        scope: "local",
        hasChanges: true,
      });
      expect(parsed.changes).toMatchObject([
        {
          key: "user.name",
          action: "set",
          after: "Work User",
        },
        {
          key: "user.email",
          action: "set",
          after: "work@example.com",
        },
      ]);

      const config = await git.listConfig();
      expect(config.all["user.name"]).toBe("Work User");
      expect(config.all["user.email"]).toBe("work@example.com");
      expect(process.exitCode).toBeUndefined();
    } finally {
      process.chdir(originalCwd);
      process.argv = originalArgv;
      if (originalXdg === undefined) {
        delete process.env.XDG_CONFIG_HOME;
      } else {
        process.env.XDG_CONFIG_HOME = originalXdg;
      }
      process.exitCode = originalExitCode;
      restoreLog();
      await safeRemove(tmpRoot);
    }
  });

  test("returns JSON error when --json query matches multiple profiles", async () => {
    const originalXdg = process.env.XDG_CONFIG_HOME;
    const originalArgv = process.argv.slice();
    const originalExitCode = process.exitCode;
    const originalCwd = process.cwd();
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gitface-use-"));
    const repoDir = path.join(tmpRoot, "repo");
    const configDir = path.join(tmpRoot, "config");
    const logs: string[] = [];
    const restoreLog = spyConsole(logs);

    await fs.mkdir(repoDir);
    const git = simpleGit({ baseDir: repoDir });
    await git.init();

    try {
      process.chdir(repoDir);
      process.env.XDG_CONFIG_HOME = configDir;
      process.exitCode = undefined;

      const service = ProfileService.create();
      await service.createProfile({
        name: "work-main",
        gitName: "Work User",
        email: "work@example.com",
      });
      await service.createProfile({
        name: "work-admin",
        gitName: "Work Admin",
        email: "work-admin@example.com",
      });

      await runCli(
        [useProfileCommand.command],
        ["node", "gitface", "use", "--query", "work", "--json"],
      );

      const parsed = JSON.parse(stripAnsi(logs.join("\n"))) as {
        status: string;
        reason: string;
      };
      expect(parsed.status).toBe("error");
      expect(parsed.reason).toContain("Multiple profiles matched query");
      expect(process.exitCode).toBe(1);

      const localConfig = await fs.readFile(path.join(repoDir, ".git", "config"), "utf8");
      expect(localConfig.includes("name =")).toBe(false);
      expect(localConfig.includes("email =")).toBe(false);
    } finally {
      process.chdir(originalCwd);
      process.argv = originalArgv;
      if (originalXdg === undefined) {
        delete process.env.XDG_CONFIG_HOME;
      } else {
        process.env.XDG_CONFIG_HOME = originalXdg;
      }
      process.exitCode = originalExitCode;
      restoreLog();
      await safeRemove(tmpRoot);
    }
  });

  test("returns Result Envelope error when --json-envelope query matches multiple profiles", async () => {
    const originalXdg = process.env.XDG_CONFIG_HOME;
    const originalArgv = process.argv.slice();
    const originalExitCode = process.exitCode;
    const originalCwd = process.cwd();
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gitface-use-"));
    const repoDir = path.join(tmpRoot, "repo");
    const configDir = path.join(tmpRoot, "config");
    const logs: string[] = [];
    const restoreLog = spyConsole(logs);

    await fs.mkdir(repoDir);
    const git = simpleGit({ baseDir: repoDir });
    await git.init();

    try {
      process.chdir(repoDir);
      process.env.XDG_CONFIG_HOME = configDir;
      process.exitCode = undefined;

      const service = ProfileService.create();
      await service.createProfile({
        name: "work-main",
        gitName: "Work User",
        email: "work@example.com",
      });
      await service.createProfile({
        name: "work-admin",
        gitName: "Work Admin",
        email: "work-admin@example.com",
      });

      await runCli(
        [useProfileCommand.command],
        ["node", "gitface", "use", "--query", "work", "--json-envelope"],
      );

      const parsed = JSON.parse(stripAnsi(logs.join("\n"))) as Record<string, unknown>;
      expect(parsed.status).toBe("error");
      expect(parsed.code).toBe("USE_PROFILE_SELECTION_FAILED");
      expect(parsed.message).toBeTypeOf("string");
      expect(parsed.data).toBeNull();
      expect(parsed.meta).toMatchObject({
        schemaVersion: "1.0.0",
      });
      expect(parsed.errors).toMatchObject([
        {
          code: "USE_PROFILE_SELECTION_FAILED",
        },
      ]);
      expect(process.exitCode).toBe(1);

      const localConfig = await fs.readFile(path.join(repoDir, ".git", "config"), "utf8");
      expect(localConfig.includes("name =")).toBe(false);
      expect(localConfig.includes("email =")).toBe(false);
    } finally {
      process.chdir(originalCwd);
      process.argv = originalArgv;
      if (originalXdg === undefined) {
        delete process.env.XDG_CONFIG_HOME;
      } else {
        process.env.XDG_CONFIG_HOME = originalXdg;
      }
      process.exitCode = originalExitCode;
      restoreLog();
      await safeRemove(tmpRoot);
    }
  });

  test("returns Result Envelope error when --json-envelope query matches multiple profiles", async () => {
    const originalXdg = process.env.XDG_CONFIG_HOME;
    const originalArgv = process.argv.slice();
    const originalExitCode = process.exitCode;
    const originalCwd = process.cwd();
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gitface-use-"));
    const repoDir = path.join(tmpRoot, "repo");
    const configDir = path.join(tmpRoot, "config");
    const logs: string[] = [];
    const restoreLog = spyConsole(logs);

    await fs.mkdir(repoDir);
    const git = simpleGit({ baseDir: repoDir });
    await git.init();

    try {
      process.chdir(repoDir);
      process.env.XDG_CONFIG_HOME = configDir;
      process.exitCode = undefined;

      const service = ProfileService.create();
      await service.createProfile({
        name: "work-main",
        gitName: "Work User",
        email: "work@example.com",
      });
      await service.createProfile({
        name: "work-admin",
        gitName: "Work Admin",
        email: "work-admin@example.com",
      });

      await runCli(
        [useProfileCommand.command],
        ["node", "gitface", "use", "--query", "work", "--json-envelope"],
      );

      const parsed = JSON.parse(stripAnsi(logs.join("\n"))) as {
        status: string;
        code: string;
        message: string;
        data: null;
        errors: Array<{ code: string; message: string }>;
        meta: { schemaVersion: string };
      };
      expect(parsed.status).toBe("error");
      expect(parsed.code).toBe("USE_PROFILE_SELECTION_FAILED");
      expect(parsed.message).toContain("Multiple profiles matched query");
      expect(parsed.data).toBeNull();
      expect(parsed.errors).toMatchObject([
        {
          code: "USE_PROFILE_SELECTION_FAILED",
        },
      ]);
      expect(parsed.meta.schemaVersion).toBe("1.0.0");
      expect(process.exitCode).toBe(1);

      const localConfig = await fs.readFile(path.join(repoDir, ".git", "config"), "utf8");
      expect(localConfig.includes("name =")).toBe(false);
      expect(localConfig.includes("email =")).toBe(false);
    } finally {
      process.chdir(originalCwd);
      process.argv = originalArgv;
      if (originalXdg === undefined) {
        delete process.env.XDG_CONFIG_HOME;
      } else {
        process.env.XDG_CONFIG_HOME = originalXdg;
      }
      process.exitCode = originalExitCode;
      restoreLog();
      await safeRemove(tmpRoot);
    }
  });

  test("interactive selection applies chosen profile", async () => {
    const originalXdg = process.env.XDG_CONFIG_HOME;
    const originalExitCode = process.exitCode;
    const originalCwd = process.cwd();
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gitface-use-"));
    const repoDir = path.join(tmpRoot, "repo");
    const configDir = path.join(tmpRoot, "config");
    const restoreTTY = setStdoutTTY(true);

    await fs.mkdir(repoDir);
    const git = simpleGit({ baseDir: repoDir });
    await git.init();

    try {
      process.chdir(repoDir);
      process.env.XDG_CONFIG_HOME = configDir;
      process.exitCode = undefined;

      const service = ProfileService.create();
      await service.createProfile({
        name: "work",
        gitName: "Work User",
        email: "work@example.com",
      });

      await runUseAction(undefined, {}, async () => "work");

      const config = await git.listConfig();
      expect(config.all["user.name"]).toBe("Work User");
      expect(config.all["user.email"]).toBe("work@example.com");
      expect(process.exitCode).toBeUndefined();
    } finally {
      restoreTTY();
      process.chdir(originalCwd);
      if (originalXdg === undefined) {
        delete process.env.XDG_CONFIG_HOME;
      } else {
        process.env.XDG_CONFIG_HOME = originalXdg;
      }
      process.exitCode = originalExitCode;
      await safeRemove(tmpRoot);
    }
  });

  test("interactive mode fails fast when no profiles exist", async () => {
    const originalXdg = process.env.XDG_CONFIG_HOME;
    const originalExitCode = process.exitCode;
    const originalCwd = process.cwd();
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gitface-use-"));
    const repoDir = path.join(tmpRoot, "repo");
    const configDir = path.join(tmpRoot, "config");
    const logs: string[] = [];
    const restoreLog = spyConsole(logs);
    const restoreTTY = setStdoutTTY(true);

    await fs.mkdir(repoDir);
    const git = simpleGit({ baseDir: repoDir });
    await git.init();

    try {
      process.chdir(repoDir);
      process.env.XDG_CONFIG_HOME = configDir;
      process.exitCode = undefined;

      await runUseAction(undefined, {}, async () => null);

      const localConfig = await fs.readFile(path.join(repoDir, ".git", "config"), "utf8");
      expect(localConfig.includes("name =")).toBe(false);
      expect(localConfig.includes("email =")).toBe(false);
      expect(process.exitCode).toBe(1);
      expect(stripAnsi(logs.join("\n"))).toContain("No profiles found");
    } finally {
      restoreTTY();
      process.chdir(originalCwd);
      if (originalXdg === undefined) {
        delete process.env.XDG_CONFIG_HOME;
      } else {
        process.env.XDG_CONFIG_HOME = originalXdg;
      }
      process.exitCode = originalExitCode;
      restoreLog();
      await safeRemove(tmpRoot);
    }
  });

  test("auto-selects single matched profile when --query is provided", async () => {
    const originalXdg = process.env.XDG_CONFIG_HOME;
    const originalExitCode = process.exitCode;
    const originalCwd = process.cwd();
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gitface-use-"));
    const repoDir = path.join(tmpRoot, "repo");
    const configDir = path.join(tmpRoot, "config");

    await fs.mkdir(repoDir);
    const git = simpleGit({ baseDir: repoDir });
    await git.init();

    try {
      process.chdir(repoDir);
      process.env.XDG_CONFIG_HOME = configDir;
      process.exitCode = undefined;

      const service = ProfileService.create();
      await service.createProfile({
        name: "work-main",
        gitName: "Work User",
        email: "work@example.com",
      });
      await service.createProfile({
        name: "personal",
        gitName: "Personal User",
        email: "personal@example.com",
      });

      await runUseAction(undefined, { query: "main" }, async () => null);

      const config = await git.listConfig();
      expect(config.all["user.name"]).toBe("Work User");
      expect(config.all["user.email"]).toBe("work@example.com");
      expect(process.exitCode).toBeUndefined();
    } finally {
      process.chdir(originalCwd);
      if (originalXdg === undefined) {
        delete process.env.XDG_CONFIG_HOME;
      } else {
        process.env.XDG_CONFIG_HOME = originalXdg;
      }
      process.exitCode = originalExitCode;
      await safeRemove(tmpRoot);
    }
  });

  test("ignores non-function third argument and still resolves --query flow", async () => {
    const originalXdg = process.env.XDG_CONFIG_HOME;
    const originalExitCode = process.exitCode;
    const originalCwd = process.cwd();
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gitface-use-"));
    const repoDir = path.join(tmpRoot, "repo");
    const configDir = path.join(tmpRoot, "config");

    await fs.mkdir(repoDir);
    const git = simpleGit({ baseDir: repoDir });
    await git.init();

    try {
      process.chdir(repoDir);
      process.env.XDG_CONFIG_HOME = configDir;
      process.exitCode = undefined;

      const service = ProfileService.create();
      await service.createProfile({
        name: "test",
        gitName: "Test User",
        email: "test@example.com",
      });

      await runUseAction(
        undefined,
        { query: "tes" },
        {} as unknown as (options: unknown) => Promise<string | null>,
      );

      const config = await git.listConfig();
      expect(config.all["user.name"]).toBe("Test User");
      expect(config.all["user.email"]).toBe("test@example.com");
      expect(process.exitCode).toBeUndefined();
    } finally {
      process.chdir(originalCwd);
      if (originalXdg === undefined) {
        delete process.env.XDG_CONFIG_HOME;
      } else {
        process.env.XDG_CONFIG_HOME = originalXdg;
      }
      process.exitCode = originalExitCode;
      await safeRemove(tmpRoot);
    }
  });

  test("fails in non-tty mode when --query matches multiple profiles", async () => {
    const originalXdg = process.env.XDG_CONFIG_HOME;
    const originalExitCode = process.exitCode;
    const originalCwd = process.cwd();
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gitface-use-"));
    const repoDir = path.join(tmpRoot, "repo");
    const configDir = path.join(tmpRoot, "config");
    const logs: string[] = [];
    const restoreLog = spyConsole(logs);
    const restoreTTY = setStdoutTTY(false);

    await fs.mkdir(repoDir);
    const git = simpleGit({ baseDir: repoDir });
    await git.init();

    try {
      process.chdir(repoDir);
      process.env.XDG_CONFIG_HOME = configDir;
      process.exitCode = undefined;

      const service = ProfileService.create();
      await service.createProfile({
        name: "work-main",
        gitName: "Work User",
        email: "work@example.com",
      });
      await service.createProfile({
        name: "work-admin",
        gitName: "Work Admin",
        email: "work-admin@example.com",
      });

      await runUseAction(undefined, { query: "work" }, async () => null);

      expect(process.exitCode).toBe(1);
      expect(stripAnsi(logs.join("\n"))).toContain("Multiple profiles matched query");
    } finally {
      restoreTTY();
      process.chdir(originalCwd);
      if (originalXdg === undefined) {
        delete process.env.XDG_CONFIG_HOME;
      } else {
        process.env.XDG_CONFIG_HOME = originalXdg;
      }
      process.exitCode = originalExitCode;
      restoreLog();
      await safeRemove(tmpRoot);
    }
  });

  test("emits dry-run plan with --json and does not mutate git config", async () => {
    const originalXdg = process.env.XDG_CONFIG_HOME;
    const originalArgv = process.argv.slice();
    const originalExitCode = process.exitCode;
    const originalCwd = process.cwd();
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gitface-use-"));
    const repoDir = path.join(tmpRoot, "repo");
    const configDir = path.join(tmpRoot, "config");
    const logs: string[] = [];
    const restoreLog = spyConsole(logs);

    await fs.mkdir(repoDir);
    const git = simpleGit({ baseDir: repoDir });
    await git.init();

    try {
      process.chdir(repoDir);
      process.env.XDG_CONFIG_HOME = configDir;

      await git.addConfig("user.name", "Current User");
      await git.addConfig("user.email", "current@example.com");

      const service = ProfileService.create();
      await service.createProfile({
        name: "work",
        gitName: "Work User",
        email: "work@example.com",
      });

      await runCli(
        [useProfileCommand.command],
        ["node", "gitface", "use", "work", "--dry-run", "--json"],
      );

      const parsed = JSON.parse(stripAnsi(logs.join("\n"))) as {
        status: string;
        scope: string;
        hasChanges: boolean;
        profile: {
          name: string;
          gitName: string;
          email: string;
          signingKey: string | null;
        };
        current: {
          gitName: string | null;
          email: string | null;
          signingKey: string | null;
        };
        changes: Array<{
          key: string;
          action: string;
          before: string | null;
          after: string | null;
        }>;
      };

      expect(parsed.status).toBe("dry-run");
      expect(parsed.scope).toBe("local");
      expect(parsed.hasChanges).toBe(true);
      expect(parsed.profile).toEqual({
        name: "work",
        gitName: "Work User",
        email: "work@example.com",
        signingKey: null,
      });
      expect(parsed.current).toEqual({
        gitName: "Current User",
        email: "current@example.com",
        signingKey: null,
      });
      expect(parsed.changes).toEqual([
        {
          key: "user.name",
          action: "set",
          before: "Current User",
          after: "Work User",
        },
        {
          key: "user.email",
          action: "set",
          before: "current@example.com",
          after: "work@example.com",
        },
      ]);

      const config = await git.listConfig();
      expect(config.all["user.name"]).toBe("Current User");
      expect(config.all["user.email"]).toBe("current@example.com");
    } finally {
      process.chdir(originalCwd);
      process.argv = originalArgv;
      if (originalXdg === undefined) {
        delete process.env.XDG_CONFIG_HOME;
      } else {
        process.env.XDG_CONFIG_HOME = originalXdg;
      }
      process.exitCode = originalExitCode;
      restoreLog();
      await safeRemove(tmpRoot);
    }
  });

  test("returns unchanged status when profile already matches local scope", async () => {
    const originalXdg = process.env.XDG_CONFIG_HOME;
    const originalArgv = process.argv.slice();
    const originalExitCode = process.exitCode;
    const originalCwd = process.cwd();
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gitface-use-"));
    const repoDir = path.join(tmpRoot, "repo");
    const configDir = path.join(tmpRoot, "config");
    const logs: string[] = [];
    const restoreLog = spyConsole(logs);

    await fs.mkdir(repoDir);
    const git = simpleGit({ baseDir: repoDir });
    await git.init();

    try {
      process.chdir(repoDir);
      process.env.XDG_CONFIG_HOME = configDir;

      await git.addConfig("user.name", "Work User");
      await git.addConfig("user.email", "work@example.com");

      const service = ProfileService.create();
      await service.createProfile({
        name: "work",
        gitName: "Work User",
        email: "work@example.com",
      });

      const gitConfigPath = path.join(repoDir, ".git", "config");
      const beforeStat = await fs.stat(gitConfigPath);
      const beforeContent = await fs.readFile(gitConfigPath, "utf8");
      await new Promise((resolve) => setTimeout(resolve, 1100));

      await runCli([useProfileCommand.command], ["node", "gitface", "use", "work", "--json"]);

      const parsed = JSON.parse(stripAnsi(logs.join("\n"))) as {
        status: string;
        name: string;
        scope: string;
        changes: unknown[];
      };

      expect(parsed.status).toBe("unchanged");
      expect(parsed.name).toBe("work");
      expect(parsed.scope).toBe("local");
      expect(parsed.changes).toEqual([]);

      const afterStat = await fs.stat(gitConfigPath);
      const afterContent = await fs.readFile(gitConfigPath, "utf8");
      expect(afterContent).toBe(beforeContent);
      expect(afterStat.mtimeMs).toBe(beforeStat.mtimeMs);
    } finally {
      process.chdir(originalCwd);
      process.argv = originalArgv;
      if (originalXdg === undefined) {
        delete process.env.XDG_CONFIG_HOME;
      } else {
        process.env.XDG_CONFIG_HOME = originalXdg;
      }
      process.exitCode = originalExitCode;
      restoreLog();
      await safeRemove(tmpRoot);
    }
  });

  test("emits empty dry-run change list when profile already matches local scope", async () => {
    const originalXdg = process.env.XDG_CONFIG_HOME;
    const originalArgv = process.argv.slice();
    const originalExitCode = process.exitCode;
    const originalCwd = process.cwd();
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gitface-use-"));
    const repoDir = path.join(tmpRoot, "repo");
    const configDir = path.join(tmpRoot, "config");
    const logs: string[] = [];
    const restoreLog = spyConsole(logs);

    await fs.mkdir(repoDir);
    const git = simpleGit({ baseDir: repoDir });
    await git.init();

    try {
      process.chdir(repoDir);
      process.env.XDG_CONFIG_HOME = configDir;

      await git.addConfig("user.name", "Work User");
      await git.addConfig("user.email", "work@example.com");

      const service = ProfileService.create();
      await service.createProfile({
        name: "work",
        gitName: "Work User",
        email: "work@example.com",
      });

      await runCli(
        [useProfileCommand.command],
        ["node", "gitface", "use", "work", "--dry-run", "--json"],
      );

      const parsed = JSON.parse(stripAnsi(logs.join("\n"))) as {
        status: string;
        hasChanges: boolean;
        changes: unknown[];
      };

      expect(parsed.status).toBe("dry-run");
      expect(parsed.hasChanges).toBe(false);
      expect(parsed.changes).toEqual([]);

      const config = await git.listConfig();
      expect(config.all["user.name"]).toBe("Work User");
      expect(config.all["user.email"]).toBe("work@example.com");
    } finally {
      process.chdir(originalCwd);
      process.argv = originalArgv;
      if (originalXdg === undefined) {
        delete process.env.XDG_CONFIG_HOME;
      } else {
        process.env.XDG_CONFIG_HOME = originalXdg;
      }
      process.exitCode = originalExitCode;
      restoreLog();
      await safeRemove(tmpRoot);
    }
  });
});
