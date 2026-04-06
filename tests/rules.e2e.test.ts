import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import simpleGit from "simple-git";
import { describe, expect, test } from "vitest";
import { rulesCommand } from "../src/commands/index";
import { ProfileService } from "../src/core/profile-service";
import { runCli, safeRemove, spyConsole, stripAnsi } from "./helpers/e2e";

describe("rules command e2e", () => {
  test("adds a rule and applies profile to directory", async () => {
    const originalXdg = process.env.XDG_CONFIG_HOME;
    const originalHome = process.env.HOME;
    const originalArgv = process.argv.slice();
    const originalExitCode = process.exitCode;
    const originalCwd = process.cwd();
    const tmpRootRaw = await fs.mkdtemp(path.join(os.tmpdir(), "gitface-rules-"));
    const tmpRoot = await fs.realpath(tmpRootRaw);
    const homeDir = path.join(tmpRoot, "home");
    const configDir = path.join(tmpRoot, "config");
    const projectDir = path.join(homeDir, "project-a");

    await fs.mkdir(homeDir, { recursive: true });
    await fs.mkdir(configDir, { recursive: true });
    await fs.mkdir(projectDir, { recursive: true });

    process.env.HOME = homeDir;
    process.env.XDG_CONFIG_HOME = configDir;

    try {
      process.chdir(homeDir);

      const service = ProfileService.create();
      await service.createProfile({
        name: "work-profile",
        gitName: "Work User",
        email: "work@example.com",
      });

      await runCli(
        [rulesCommand.command],
        ["node", "gitface", "rules", "add", projectDir, "work-profile"],
      );

      const gitGlobal = simpleGit({ baseDir: homeDir });
      const globalConfig = await gitGlobal.listConfig("global");
      const includeIfKey = Object.keys(globalConfig.all).find((key) =>
        key.toLowerCase().includes(projectDir.toLowerCase()),
      );
      expect(includeIfKey).toBeDefined();

      const gitProject = simpleGit({ baseDir: projectDir });
      await gitProject.init();
      const projectConfig = await gitProject.listConfig();

      expect(projectConfig.all["user.name"]).toBe("Work User");
      expect(projectConfig.all["user.email"]).toBe("work@example.com");

      await runCli([rulesCommand.command], ["node", "gitface", "rules", "remove", projectDir]);

      const globalConfigAfter = await gitGlobal.listConfig("global");
      const includeIfKeyAfter = Object.keys(globalConfigAfter.all).find((key) =>
        key.toLowerCase().includes(projectDir.toLowerCase()),
      );
      expect(includeIfKeyAfter).toBeUndefined();
    } finally {
      process.chdir(originalCwd);
      process.argv = originalArgv;
      process.env.HOME = originalHome;
      if (originalXdg === undefined) {
        delete process.env.XDG_CONFIG_HOME;
      } else {
        process.env.XDG_CONFIG_HOME = originalXdg;
      }
      process.exitCode = originalExitCode;
      await safeRemove(tmpRoot);
    }
  });

  test("lists rules as json with --json", async () => {
    const originalXdg = process.env.XDG_CONFIG_HOME;
    const originalHome = process.env.HOME;
    const originalArgv = process.argv.slice();
    const originalExitCode = process.exitCode;
    const originalCwd = process.cwd();
    const tmpRootRaw = await fs.mkdtemp(path.join(os.tmpdir(), "gitface-rules-json-"));
    const tmpRoot = await fs.realpath(tmpRootRaw);
    const homeDir = path.join(tmpRoot, "home");
    const configDir = path.join(tmpRoot, "config");
    const projectDir = path.join(homeDir, "project-b");
    const logs: string[] = [];

    await fs.mkdir(homeDir, { recursive: true });
    await fs.mkdir(configDir, { recursive: true });
    await fs.mkdir(projectDir, { recursive: true });

    process.env.HOME = homeDir;
    process.env.XDG_CONFIG_HOME = configDir;

    try {
      process.chdir(homeDir);

      const service = ProfileService.create();
      await service.createProfile({
        name: "ops-profile",
        gitName: "Ops User",
        email: "ops@example.com",
      });

      await runCli(
        [rulesCommand.command],
        ["node", "gitface", "rules", "add", projectDir, "ops-profile"],
      );

      const restoreLog = spyConsole(logs);
      await runCli([rulesCommand.command], ["node", "gitface", "rules", "list", "--json"]);
      restoreLog();

      const output = stripAnsi(logs.join("\n")).trim();
      const parsed = JSON.parse(output) as Array<{
        directory: string;
        profileName: string;
      }>;

      expect(parsed).toContainEqual({
        directory: `${projectDir}${path.sep}`,
        profileName: "ops-profile",
      });
    } finally {
      process.chdir(originalCwd);
      process.argv = originalArgv;
      process.env.HOME = originalHome;
      if (originalXdg === undefined) {
        delete process.env.XDG_CONFIG_HOME;
      } else {
        process.env.XDG_CONFIG_HOME = originalXdg;
      }
      process.exitCode = originalExitCode;
      await safeRemove(tmpRoot);
    }
  });

  test("adds and removes rules with --json payloads", async () => {
    const originalXdg = process.env.XDG_CONFIG_HOME;
    const originalHome = process.env.HOME;
    const originalArgv = process.argv.slice();
    const originalExitCode = process.exitCode;
    const originalCwd = process.cwd();
    const tmpRootRaw = await fs.mkdtemp(path.join(os.tmpdir(), "gitface-rules-mutation-json-"));
    const tmpRoot = await fs.realpath(tmpRootRaw);
    const homeDir = path.join(tmpRoot, "home");
    const configDir = path.join(tmpRoot, "config");
    const projectDir = path.join(homeDir, "project-c");
    const logs: string[] = [];

    await fs.mkdir(homeDir, { recursive: true });
    await fs.mkdir(configDir, { recursive: true });
    await fs.mkdir(projectDir, { recursive: true });

    process.env.HOME = homeDir;
    process.env.XDG_CONFIG_HOME = configDir;

    try {
      process.chdir(homeDir);

      const service = ProfileService.create();
      await service.createProfile({
        name: "eng-profile",
        gitName: "Eng User",
        email: "eng@example.com",
      });

      const restoreLog = spyConsole(logs);
      await runCli(
        [rulesCommand.command],
        ["node", "gitface", "rules", "add", projectDir, "eng-profile", "--json"],
      );
      restoreLog();

      const addOutput = stripAnsi(logs.join("\n")).trim();
      const addParsed = JSON.parse(addOutput) as {
        status: string;
        directory: string;
        profileName: string;
      };
      expect(addParsed).toEqual({
        status: "added",
        directory: `${projectDir}${path.sep}`,
        profileName: "eng-profile",
      });

      logs.length = 0;
      const restoreLog2 = spyConsole(logs);
      await runCli(
        [rulesCommand.command],
        ["node", "gitface", "rules", "remove", projectDir, "--json"],
      );
      restoreLog2();

      const removeOutput = stripAnsi(logs.join("\n")).trim();
      const removeParsed = JSON.parse(removeOutput) as {
        status: string;
        directory: string;
      };
      expect(removeParsed).toEqual({
        status: "removed",
        directory: `${projectDir}${path.sep}`,
      });
    } finally {
      process.chdir(originalCwd);
      process.argv = originalArgv;
      process.env.HOME = originalHome;
      if (originalXdg === undefined) {
        delete process.env.XDG_CONFIG_HOME;
      } else {
        process.env.XDG_CONFIG_HOME = originalXdg;
      }
      process.exitCode = originalExitCode;
      await safeRemove(tmpRoot);
    }
  });

  test("adds and removes rules with --json-envelope payloads", async () => {
    const originalXdg = process.env.XDG_CONFIG_HOME;
    const originalHome = process.env.HOME;
    const originalArgv = process.argv.slice();
    const originalExitCode = process.exitCode;
    const originalCwd = process.cwd();
    const tmpRootRaw = await fs.mkdtemp(path.join(os.tmpdir(), "gitface-rules-mutation-envelope-"));
    const tmpRoot = await fs.realpath(tmpRootRaw);
    const homeDir = path.join(tmpRoot, "home");
    const configDir = path.join(tmpRoot, "config");
    const projectDir = path.join(homeDir, "project-envelope");
    const logs: string[] = [];

    await fs.mkdir(homeDir, { recursive: true });
    await fs.mkdir(configDir, { recursive: true });
    await fs.mkdir(projectDir, { recursive: true });

    process.env.HOME = homeDir;
    process.env.XDG_CONFIG_HOME = configDir;

    try {
      process.chdir(homeDir);

      const service = ProfileService.create();
      await service.createProfile({
        name: "eng-profile",
        gitName: "Eng User",
        email: "eng@example.com",
      });

      const restoreLog = spyConsole(logs);
      await runCli(
        [rulesCommand.command],
        ["node", "gitface", "rules", "add", projectDir, "eng-profile", "--json-envelope"],
      );
      restoreLog();

      const addOutput = stripAnsi(logs.join("\n")).trim();
      const addParsed = JSON.parse(addOutput) as {
        status: string;
        code: string;
        data: {
          result: string;
          directory: string;
          profileName: string;
          overwrite: boolean;
        };
        meta: { schemaVersion: string; durationMs: number; traceId: string };
      };
      expect(addParsed.status).toBe("success");
      expect(addParsed.code).toBe("RULE_ADD_OK");
      expect(addParsed.data).toEqual({
        result: "added",
        directory: `${projectDir}${path.sep}`,
        profileName: "eng-profile",
        overwrite: false,
      });
      expect(addParsed.meta.schemaVersion).toBe("1.0.0");
      expect(addParsed.meta.durationMs).toBeGreaterThanOrEqual(0);
      expect(addParsed.meta.traceId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );

      logs.length = 0;
      const restoreLog2 = spyConsole(logs);
      await runCli(
        [rulesCommand.command],
        ["node", "gitface", "rules", "remove", projectDir, "--json-envelope"],
      );
      restoreLog2();

      const removeOutput = stripAnsi(logs.join("\n")).trim();
      const removeParsed = JSON.parse(removeOutput) as {
        status: string;
        code: string;
        data: {
          result: string;
          directory: string;
          exists: boolean | null;
        };
        meta: { schemaVersion: string; durationMs: number; traceId: string };
      };
      expect(removeParsed.status).toBe("success");
      expect(removeParsed.code).toBe("RULE_REMOVE_OK");
      expect(removeParsed.data).toEqual({
        result: "removed",
        directory: `${projectDir}${path.sep}`,
        exists: null,
      });
      expect(removeParsed.meta.schemaVersion).toBe("1.0.0");
      expect(removeParsed.meta.durationMs).toBeGreaterThanOrEqual(0);
      expect(removeParsed.meta.traceId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    } finally {
      process.chdir(originalCwd);
      process.argv = originalArgv;
      process.env.HOME = originalHome;
      if (originalXdg === undefined) {
        delete process.env.XDG_CONFIG_HOME;
      } else {
        process.env.XDG_CONFIG_HOME = originalXdg;
      }
      process.exitCode = originalExitCode;
      await safeRemove(tmpRoot);
    }
  });

  test("returns json error when adding rule with missing profile", async () => {
    const originalXdg = process.env.XDG_CONFIG_HOME;
    const originalHome = process.env.HOME;
    const originalArgv = process.argv.slice();
    const originalExitCode = process.exitCode;
    const originalCwd = process.cwd();
    const tmpRootRaw = await fs.mkdtemp(path.join(os.tmpdir(), "gitface-rules-add-error-json-"));
    const tmpRoot = await fs.realpath(tmpRootRaw);
    const homeDir = path.join(tmpRoot, "home");
    const configDir = path.join(tmpRoot, "config");
    const projectDir = path.join(homeDir, "project-d");
    const logs: string[] = [];

    await fs.mkdir(homeDir, { recursive: true });
    await fs.mkdir(configDir, { recursive: true });
    await fs.mkdir(projectDir, { recursive: true });

    process.env.HOME = homeDir;
    process.env.XDG_CONFIG_HOME = configDir;

    try {
      process.chdir(homeDir);
      const service = ProfileService.create();
      await service.createProfile({
        name: "work-profile",
        gitName: "Work User",
        email: "work@example.com",
      });

      const restoreLog = spyConsole(logs);
      await runCli(
        [rulesCommand.command],
        ["node", "gitface", "rules", "add", projectDir, "missing", "--json"],
      );
      restoreLog();

      const output = stripAnsi(logs.join("\n")).trim();
      const parsed = JSON.parse(output) as {
        status: string;
        directory: string;
        profileName: string;
        reason: string;
      };

      expect(parsed.status).toBe("error");
      expect(parsed.profileName).toBe("missing");
      expect(parsed.directory).toBe(`${projectDir}${path.sep}`);
      expect(parsed.reason).toContain("not found");
      expect(parsed.reason).toContain("Did you mean");
      expect(parsed.reason).toContain("'work-profile'");
      expect(process.exitCode).toBe(1);
    } finally {
      process.chdir(originalCwd);
      process.argv = originalArgv;
      process.env.HOME = originalHome;
      if (originalXdg === undefined) {
        delete process.env.XDG_CONFIG_HOME;
      } else {
        process.env.XDG_CONFIG_HOME = originalXdg;
      }
      process.exitCode = originalExitCode;
      await safeRemove(tmpRoot);
    }
  });

  test("returns envelope error when adding rule with missing profile", async () => {
    const originalXdg = process.env.XDG_CONFIG_HOME;
    const originalHome = process.env.HOME;
    const originalArgv = process.argv.slice();
    const originalExitCode = process.exitCode;
    const originalCwd = process.cwd();
    const tmpRootRaw = await fs.mkdtemp(
      path.join(os.tmpdir(), "gitface-rules-add-error-envelope-"),
    );
    const tmpRoot = await fs.realpath(tmpRootRaw);
    const homeDir = path.join(tmpRoot, "home");
    const configDir = path.join(tmpRoot, "config");
    const projectDir = path.join(homeDir, "project-envelope-error");
    const logs: string[] = [];

    await fs.mkdir(homeDir, { recursive: true });
    await fs.mkdir(configDir, { recursive: true });
    await fs.mkdir(projectDir, { recursive: true });

    process.env.HOME = homeDir;
    process.env.XDG_CONFIG_HOME = configDir;

    try {
      process.chdir(homeDir);
      const service = ProfileService.create();
      await service.createProfile({
        name: "work-profile",
        gitName: "Work User",
        email: "work@example.com",
      });

      const restoreLog = spyConsole(logs);
      await runCli(
        [rulesCommand.command],
        ["node", "gitface", "rules", "add", projectDir, "missing", "--json-envelope"],
      );
      restoreLog();

      const output = stripAnsi(logs.join("\n")).trim();
      const parsed = JSON.parse(output) as {
        status: string;
        code: string;
        message: string;
        data: {
          result: string;
          directory: string;
          profileName: string;
          overwrite: boolean;
        };
        errors: Array<{ code: string; message: string }>;
        meta: { schemaVersion: string; durationMs: number; traceId: string };
      };

      expect(parsed.status).toBe("error");
      expect(parsed.code).toBe("RULE_ADD_FAILED");
      expect(parsed.message).toContain("not found");
      expect(parsed.message).toContain("'work-profile'");
      expect(parsed.data).toEqual({
        result: "added",
        directory: `${projectDir}${path.sep}`,
        profileName: "missing",
        overwrite: false,
      });
      expect(parsed.errors).toEqual([{ code: "RULE_ADD_FAILED", message: parsed.message }]);
      expect(parsed.meta.schemaVersion).toBe("1.0.0");
      expect(parsed.meta.durationMs).toBeGreaterThanOrEqual(0);
      expect(parsed.meta.traceId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      expect(process.exitCode).toBe(1);
    } finally {
      process.chdir(originalCwd);
      process.argv = originalArgv;
      process.env.HOME = originalHome;
      if (originalXdg === undefined) {
        delete process.env.XDG_CONFIG_HOME;
      } else {
        process.env.XDG_CONFIG_HOME = originalXdg;
      }
      process.exitCode = originalExitCode;
      await safeRemove(tmpRoot);
    }
  });

  test("previews add with --dry-run --json without mutating global config", async () => {
    const originalXdg = process.env.XDG_CONFIG_HOME;
    const originalHome = process.env.HOME;
    const originalArgv = process.argv.slice();
    const originalExitCode = process.exitCode;
    const originalCwd = process.cwd();
    const tmpRootRaw = await fs.mkdtemp(path.join(os.tmpdir(), "gitface-rules-add-dry-run-"));
    const tmpRoot = await fs.realpath(tmpRootRaw);
    const homeDir = path.join(tmpRoot, "home");
    const configDir = path.join(tmpRoot, "config");
    const projectDir = path.join(homeDir, "project-e");
    const logs: string[] = [];

    await fs.mkdir(homeDir, { recursive: true });
    await fs.mkdir(configDir, { recursive: true });
    await fs.mkdir(projectDir, { recursive: true });

    process.env.HOME = homeDir;
    process.env.XDG_CONFIG_HOME = configDir;

    try {
      process.chdir(homeDir);
      const service = ProfileService.create();
      await service.createProfile({
        name: "preview-profile",
        gitName: "Preview User",
        email: "preview@example.com",
      });

      const restoreLog = spyConsole(logs);
      await runCli(
        [rulesCommand.command],
        ["node", "gitface", "rules", "add", projectDir, "preview-profile", "--dry-run", "--json"],
      );
      restoreLog();

      const output = stripAnsi(logs.join("\n")).trim();
      const parsed = JSON.parse(output) as {
        status: string;
        directory: string;
        profileName: string;
        overwrite: boolean;
      };
      expect(parsed).toEqual({
        status: "dry-run",
        directory: `${projectDir}${path.sep}`,
        profileName: "preview-profile",
        overwrite: false,
      });

      const globalConfigPath = path.join(homeDir, ".gitconfig");
      const hasGlobalConfig = await fs
        .access(globalConfigPath)
        .then(() => true)
        .catch(() => false);
      expect(hasGlobalConfig).toBe(false);
    } finally {
      process.chdir(originalCwd);
      process.argv = originalArgv;
      process.env.HOME = originalHome;
      if (originalXdg === undefined) {
        delete process.env.XDG_CONFIG_HOME;
      } else {
        process.env.XDG_CONFIG_HOME = originalXdg;
      }
      process.exitCode = originalExitCode;
      await safeRemove(tmpRoot);
    }
  });

  test("previews remove with --dry-run --json and keeps existing rule", async () => {
    const originalXdg = process.env.XDG_CONFIG_HOME;
    const originalHome = process.env.HOME;
    const originalArgv = process.argv.slice();
    const originalExitCode = process.exitCode;
    const originalCwd = process.cwd();
    const tmpRootRaw = await fs.mkdtemp(path.join(os.tmpdir(), "gitface-rules-remove-dry-run-"));
    const tmpRoot = await fs.realpath(tmpRootRaw);
    const homeDir = path.join(tmpRoot, "home");
    const configDir = path.join(tmpRoot, "config");
    const projectDir = path.join(homeDir, "project-f");
    const logs: string[] = [];

    await fs.mkdir(homeDir, { recursive: true });
    await fs.mkdir(configDir, { recursive: true });
    await fs.mkdir(projectDir, { recursive: true });

    process.env.HOME = homeDir;
    process.env.XDG_CONFIG_HOME = configDir;

    try {
      process.chdir(homeDir);
      const service = ProfileService.create();
      await service.createProfile({
        name: "ops-profile",
        gitName: "Ops User",
        email: "ops@example.com",
      });
      await runCli(
        [rulesCommand.command],
        ["node", "gitface", "rules", "add", projectDir, "ops-profile"],
      );

      const restoreLog = spyConsole(logs);
      await runCli(
        [rulesCommand.command],
        ["node", "gitface", "rules", "remove", projectDir, "--dry-run", "--json"],
      );
      restoreLog();

      const output = stripAnsi(logs.join("\n")).trim();
      const parsed = JSON.parse(output) as {
        status: string;
        directory: string;
        exists: boolean;
      };
      expect(parsed).toEqual({
        status: "dry-run",
        directory: `${projectDir}${path.sep}`,
        exists: true,
      });

      const gitGlobal = simpleGit({ baseDir: homeDir });
      const globalConfig = await gitGlobal.listConfig("global");
      const includeIfKey = Object.keys(globalConfig.all).find((key) =>
        key.toLowerCase().includes(projectDir.toLowerCase()),
      );
      expect(includeIfKey).toBeDefined();
    } finally {
      process.chdir(originalCwd);
      process.argv = originalArgv;
      process.env.HOME = originalHome;
      if (originalXdg === undefined) {
        delete process.env.XDG_CONFIG_HOME;
      } else {
        process.env.XDG_CONFIG_HOME = originalXdg;
      }
      process.exitCode = originalExitCode;
      await safeRemove(tmpRoot);
    }
  });

  test("filters and limits listed rules with --json", async () => {
    const originalXdg = process.env.XDG_CONFIG_HOME;
    const originalHome = process.env.HOME;
    const originalArgv = process.argv.slice();
    const originalExitCode = process.exitCode;
    const originalCwd = process.cwd();
    const tmpRootRaw = await fs.mkdtemp(path.join(os.tmpdir(), "gitface-rules-list-filter-limit-"));
    const tmpRoot = await fs.realpath(tmpRootRaw);
    const homeDir = path.join(tmpRoot, "home");
    const configDir = path.join(tmpRoot, "config");
    const alphaDir = path.join(homeDir, "alpha-project");
    const betaDir = path.join(homeDir, "beta-project");
    const zetaDir = path.join(homeDir, "zeta-project");
    const logs: string[] = [];

    await fs.mkdir(homeDir, { recursive: true });
    await fs.mkdir(configDir, { recursive: true });
    await fs.mkdir(alphaDir, { recursive: true });
    await fs.mkdir(betaDir, { recursive: true });
    await fs.mkdir(zetaDir, { recursive: true });

    process.env.HOME = homeDir;
    process.env.XDG_CONFIG_HOME = configDir;

    try {
      process.chdir(homeDir);
      const service = ProfileService.create();
      await service.createProfile({
        name: "work-profile",
        gitName: "Work User",
        email: "work@example.com",
      });

      await runCli(
        [rulesCommand.command],
        ["node", "gitface", "rules", "add", zetaDir, "work-profile"],
      );
      await runCli(
        [rulesCommand.command],
        ["node", "gitface", "rules", "add", alphaDir, "work-profile"],
      );
      await runCli(
        [rulesCommand.command],
        ["node", "gitface", "rules", "add", betaDir, "work-profile"],
      );

      const restoreLog = spyConsole(logs);
      await runCli(
        [rulesCommand.command],
        ["node", "gitface", "rules", "list", "--json", "--query", "project", "--limit", "2"],
      );
      restoreLog();

      const output = stripAnsi(logs.join("\n")).trim();
      const parsed = JSON.parse(output) as Array<{
        directory: string;
        profileName: string;
      }>;

      expect(parsed).toHaveLength(2);
      expect(parsed[0].directory).toBe(`${alphaDir}${path.sep}`);
      expect(parsed[1].directory).toBe(`${betaDir}${path.sep}`);
      expect(parsed.every((item) => item.profileName === "work-profile")).toBe(true);
    } finally {
      process.chdir(originalCwd);
      process.argv = originalArgv;
      process.env.HOME = originalHome;
      if (originalXdg === undefined) {
        delete process.env.XDG_CONFIG_HOME;
      } else {
        process.env.XDG_CONFIG_HOME = originalXdg;
      }
      process.exitCode = originalExitCode;
      await safeRemove(tmpRoot);
    }
  });

  test("lists rule health report with --health --json", async () => {
    const originalXdg = process.env.XDG_CONFIG_HOME;
    const originalHome = process.env.HOME;
    const originalArgv = process.argv.slice();
    const originalExitCode = process.exitCode;
    const originalCwd = process.cwd();
    const tmpRootRaw = await fs.mkdtemp(path.join(os.tmpdir(), "gitface-rules-list-health-"));
    const tmpRoot = await fs.realpath(tmpRootRaw);
    const homeDir = path.join(tmpRoot, "home");
    const configDir = path.join(tmpRoot, "config");
    const healthyDir = path.join(homeDir, "healthy-project");
    const missingDirectory = path.join(homeDir, "deleted-project");
    const missingProfileDir = path.join(homeDir, "missing-profile-project");
    const logs: string[] = [];

    await fs.mkdir(homeDir, { recursive: true });
    await fs.mkdir(configDir, { recursive: true });
    await fs.mkdir(healthyDir, { recursive: true });
    await fs.mkdir(missingDirectory, { recursive: true });
    await fs.mkdir(missingProfileDir, { recursive: true });

    process.env.HOME = homeDir;
    process.env.XDG_CONFIG_HOME = configDir;

    try {
      process.chdir(homeDir);
      const service = ProfileService.create();
      await service.createProfile({
        name: "healthy-profile",
        gitName: "Healthy User",
        email: "healthy@example.com",
      });
      await service.createProfile({
        name: "deprecated-profile",
        gitName: "Deprecated User",
        email: "deprecated@example.com",
      });

      await runCli(
        [rulesCommand.command],
        ["node", "gitface", "rules", "add", healthyDir, "healthy-profile"],
      );
      await runCli(
        [rulesCommand.command],
        ["node", "gitface", "rules", "add", missingDirectory, "healthy-profile"],
      );
      await runCli(
        [rulesCommand.command],
        ["node", "gitface", "rules", "add", missingProfileDir, "deprecated-profile"],
      );

      await fs.rm(missingDirectory, { recursive: true, force: true });
      await service.removeProfile("deprecated-profile");

      const restoreLog = spyConsole(logs);
      await runCli(
        [rulesCommand.command],
        ["node", "gitface", "rules", "list", "--health", "--concurrency", "2", "--json"],
      );
      restoreLog();

      const output = stripAnsi(logs.join("\n")).trim();
      const parsed = JSON.parse(output) as {
        rules: Array<{
          directory: string;
          profileName: string;
          status: "pass" | "warn" | "fail";
          profileExists: boolean;
          directoryExists: boolean;
        }>;
        summary: {
          total: number;
          pass: number;
          warn: number;
          fail: number;
        };
        metrics: {
          concurrency: number;
          scanned: number;
          uniqueProfilesChecked: number;
          uniqueDirectoriesChecked: number;
          scanDurationMs: number;
        };
      };

      expect(parsed.summary).toEqual({
        total: 3,
        pass: 1,
        warn: 1,
        fail: 1,
      });
      expect(parsed.metrics.scanned).toBe(3);
      expect(parsed.metrics.concurrency).toBeGreaterThan(0);

      const byDirectory = new Map(parsed.rules.map((item) => [item.directory, item]));
      expect(byDirectory.get(`${healthyDir}${path.sep}`)?.status).toBe("pass");
      expect(byDirectory.get(`${missingDirectory}${path.sep}`)?.status).toBe("warn");
      expect(byDirectory.get(`${missingProfileDir}${path.sep}`)?.status).toBe("fail");
    } finally {
      process.chdir(originalCwd);
      process.argv = originalArgv;
      process.env.HOME = originalHome;
      if (originalXdg === undefined) {
        delete process.env.XDG_CONFIG_HOME;
      } else {
        process.env.XDG_CONFIG_HOME = originalXdg;
      }
      process.exitCode = originalExitCode;
      await safeRemove(tmpRoot);
    }
  });

  test("fails when using --concurrency without --health", async () => {
    const originalXdg = process.env.XDG_CONFIG_HOME;
    const originalHome = process.env.HOME;
    const originalArgv = process.argv.slice();
    const originalExitCode = process.exitCode;
    const originalCwd = process.cwd();
    const tmpRootRaw = await fs.mkdtemp(path.join(os.tmpdir(), "gitface-rules-list-concurrency-"));
    const tmpRoot = await fs.realpath(tmpRootRaw);
    const homeDir = path.join(tmpRoot, "home");
    const configDir = path.join(tmpRoot, "config");

    await fs.mkdir(homeDir, { recursive: true });
    await fs.mkdir(configDir, { recursive: true });
    process.env.HOME = homeDir;
    process.env.XDG_CONFIG_HOME = configDir;

    try {
      process.chdir(homeDir);
      await runCli(
        [rulesCommand.command],
        ["node", "gitface", "rules", "list", "--concurrency", "2"],
      );
      expect(process.exitCode).toBe(1);
    } finally {
      process.chdir(originalCwd);
      process.argv = originalArgv;
      process.env.HOME = originalHome;
      if (originalXdg === undefined) {
        delete process.env.XDG_CONFIG_HOME;
      } else {
        process.env.XDG_CONFIG_HOME = originalXdg;
      }
      process.exitCode = originalExitCode;
      await safeRemove(tmpRoot);
    }
  });

  test("resolves most specific matching rule with --json", async () => {
    const originalXdg = process.env.XDG_CONFIG_HOME;
    const originalHome = process.env.HOME;
    const originalArgv = process.argv.slice();
    const originalExitCode = process.exitCode;
    const originalCwd = process.cwd();
    const tmpRootRaw = await fs.mkdtemp(path.join(os.tmpdir(), "gitface-rules-resolve-match-"));
    const tmpRoot = await fs.realpath(tmpRootRaw);
    const homeDir = path.join(tmpRoot, "home");
    const configDir = path.join(tmpRoot, "config");
    const workDir = path.join(homeDir, "work");
    const monorepoDir = path.join(workDir, "monorepo");
    const packageDir = path.join(monorepoDir, "packages", "api");
    const logs: string[] = [];

    await fs.mkdir(homeDir, { recursive: true });
    await fs.mkdir(configDir, { recursive: true });
    await fs.mkdir(workDir, { recursive: true });
    await fs.mkdir(monorepoDir, { recursive: true });
    await fs.mkdir(packageDir, { recursive: true });

    process.env.HOME = homeDir;
    process.env.XDG_CONFIG_HOME = configDir;

    try {
      process.chdir(homeDir);
      const service = ProfileService.create();
      await service.createProfile({
        name: "work-profile",
        gitName: "Work User",
        email: "work@example.com",
      });
      await service.createProfile({
        name: "mono-profile",
        gitName: "Monorepo User",
        email: "mono@example.com",
      });

      await runCli(
        [rulesCommand.command],
        ["node", "gitface", "rules", "add", workDir, "work-profile"],
      );
      await runCli(
        [rulesCommand.command],
        ["node", "gitface", "rules", "add", monorepoDir, "mono-profile"],
      );

      const restoreLog = spyConsole(logs);
      await runCli(
        [rulesCommand.command],
        ["node", "gitface", "rules", "resolve", packageDir, "--json"],
      );
      restoreLog();

      const output = stripAnsi(logs.join("\n")).trim();
      const parsed = JSON.parse(output) as {
        status: string;
        directory: string;
        matchedRule: {
          directory: string;
          profileName: string;
        };
        profileExists: boolean;
      };

      expect(parsed).toEqual({
        status: "matched",
        directory: `${packageDir}${path.sep}`,
        matchedRule: {
          directory: `${monorepoDir}${path.sep}`,
          profileName: "mono-profile",
        },
        profileExists: true,
      });
      expect(process.exitCode).toBeUndefined();
    } finally {
      process.chdir(originalCwd);
      process.argv = originalArgv;
      process.env.HOME = originalHome;
      if (originalXdg === undefined) {
        delete process.env.XDG_CONFIG_HOME;
      } else {
        process.env.XDG_CONFIG_HOME = originalXdg;
      }
      process.exitCode = originalExitCode;
      await safeRemove(tmpRoot);
    }
  });

  test("resolves most specific matching rule with --json-envelope", async () => {
    const originalXdg = process.env.XDG_CONFIG_HOME;
    const originalHome = process.env.HOME;
    const originalArgv = process.argv.slice();
    const originalExitCode = process.exitCode;
    const originalCwd = process.cwd();
    const tmpRootRaw = await fs.mkdtemp(
      path.join(os.tmpdir(), "gitface-rules-resolve-envelope-match-"),
    );
    const tmpRoot = await fs.realpath(tmpRootRaw);
    const homeDir = path.join(tmpRoot, "home");
    const configDir = path.join(tmpRoot, "config");
    const workDir = path.join(homeDir, "work");
    const monorepoDir = path.join(workDir, "monorepo");
    const packageDir = path.join(monorepoDir, "packages", "api");
    const logs: string[] = [];

    await fs.mkdir(homeDir, { recursive: true });
    await fs.mkdir(configDir, { recursive: true });
    await fs.mkdir(workDir, { recursive: true });
    await fs.mkdir(monorepoDir, { recursive: true });
    await fs.mkdir(packageDir, { recursive: true });

    process.env.HOME = homeDir;
    process.env.XDG_CONFIG_HOME = configDir;

    try {
      process.chdir(homeDir);
      const service = ProfileService.create();
      await service.createProfile({
        name: "work-profile",
        gitName: "Work User",
        email: "work@example.com",
      });
      await service.createProfile({
        name: "mono-profile",
        gitName: "Monorepo User",
        email: "mono@example.com",
      });

      await runCli(
        [rulesCommand.command],
        ["node", "gitface", "rules", "add", workDir, "work-profile"],
      );
      await runCli(
        [rulesCommand.command],
        ["node", "gitface", "rules", "add", monorepoDir, "mono-profile"],
      );

      const restoreLog = spyConsole(logs);
      await runCli(
        [rulesCommand.command],
        ["node", "gitface", "rules", "resolve", packageDir, "--json-envelope"],
      );
      restoreLog();

      const output = stripAnsi(logs.join("\n")).trim();
      const parsed = JSON.parse(output) as {
        status: string;
        code: string;
        data: {
          result: string;
          directory: string;
          matchedRule: { directory: string; profileName: string };
          profileExists: boolean;
        };
        meta: { schemaVersion: string; durationMs: number; traceId: string };
      };

      expect(parsed.status).toBe("success");
      expect(parsed.code).toBe("RULE_RESOLVE_MATCHED");
      expect(parsed.data).toEqual({
        result: "matched",
        directory: `${packageDir}${path.sep}`,
        matchedRule: {
          directory: `${monorepoDir}${path.sep}`,
          profileName: "mono-profile",
        },
        profileExists: true,
      });
      expect(parsed.meta.schemaVersion).toBe("1.0.0");
      expect(parsed.meta.durationMs).toBeGreaterThanOrEqual(0);
      expect(parsed.meta.traceId.length).toBeGreaterThan(0);
      expect(process.exitCode).toBeUndefined();
    } finally {
      process.chdir(originalCwd);
      process.argv = originalArgv;
      process.env.HOME = originalHome;
      if (originalXdg === undefined) {
        delete process.env.XDG_CONFIG_HOME;
      } else {
        process.env.XDG_CONFIG_HOME = originalXdg;
      }
      process.exitCode = originalExitCode;
      await safeRemove(tmpRoot);
    }
  });

  test("returns unmatched status when no rule matches target directory", async () => {
    const originalXdg = process.env.XDG_CONFIG_HOME;
    const originalHome = process.env.HOME;
    const originalArgv = process.argv.slice();
    const originalExitCode = process.exitCode;
    const originalCwd = process.cwd();
    const tmpRootRaw = await fs.mkdtemp(path.join(os.tmpdir(), "gitface-rules-resolve-unmatched-"));
    const tmpRoot = await fs.realpath(tmpRootRaw);
    const homeDir = path.join(tmpRoot, "home");
    const configDir = path.join(tmpRoot, "config");
    const ruleDir = path.join(homeDir, "work");
    const targetDir = path.join(homeDir, "personal");
    const logs: string[] = [];

    await fs.mkdir(homeDir, { recursive: true });
    await fs.mkdir(configDir, { recursive: true });
    await fs.mkdir(ruleDir, { recursive: true });
    await fs.mkdir(targetDir, { recursive: true });

    process.env.HOME = homeDir;
    process.env.XDG_CONFIG_HOME = configDir;

    try {
      process.chdir(homeDir);
      const service = ProfileService.create();
      await service.createProfile({
        name: "work-profile",
        gitName: "Work User",
        email: "work@example.com",
      });

      await runCli(
        [rulesCommand.command],
        ["node", "gitface", "rules", "add", ruleDir, "work-profile"],
      );

      const restoreLog = spyConsole(logs);
      await runCli(
        [rulesCommand.command],
        ["node", "gitface", "rules", "resolve", targetDir, "--json"],
      );
      restoreLog();

      const output = stripAnsi(logs.join("\n")).trim();
      const parsed = JSON.parse(output) as {
        status: string;
        directory: string;
        matchedRule: null;
        profileExists: null;
      };
      expect(parsed).toEqual({
        status: "unmatched",
        directory: `${targetDir}${path.sep}`,
        matchedRule: null,
        profileExists: null,
      });
      expect(process.exitCode).toBeUndefined();
    } finally {
      process.chdir(originalCwd);
      process.argv = originalArgv;
      process.env.HOME = originalHome;
      if (originalXdg === undefined) {
        delete process.env.XDG_CONFIG_HOME;
      } else {
        process.env.XDG_CONFIG_HOME = originalXdg;
      }
      process.exitCode = originalExitCode;
      await safeRemove(tmpRoot);
    }
  });

  test("returns unmatched envelope when no rule matches target directory", async () => {
    const originalXdg = process.env.XDG_CONFIG_HOME;
    const originalHome = process.env.HOME;
    const originalArgv = process.argv.slice();
    const originalExitCode = process.exitCode;
    const originalCwd = process.cwd();
    const tmpRootRaw = await fs.mkdtemp(
      path.join(os.tmpdir(), "gitface-rules-resolve-envelope-unmatched-"),
    );
    const tmpRoot = await fs.realpath(tmpRootRaw);
    const homeDir = path.join(tmpRoot, "home");
    const configDir = path.join(tmpRoot, "config");
    const ruleDir = path.join(homeDir, "work");
    const targetDir = path.join(homeDir, "personal");
    const logs: string[] = [];

    await fs.mkdir(homeDir, { recursive: true });
    await fs.mkdir(configDir, { recursive: true });
    await fs.mkdir(ruleDir, { recursive: true });
    await fs.mkdir(targetDir, { recursive: true });

    process.env.HOME = homeDir;
    process.env.XDG_CONFIG_HOME = configDir;

    try {
      process.chdir(homeDir);
      const service = ProfileService.create();
      await service.createProfile({
        name: "work-profile",
        gitName: "Work User",
        email: "work@example.com",
      });

      await runCli(
        [rulesCommand.command],
        ["node", "gitface", "rules", "add", ruleDir, "work-profile"],
      );

      const restoreLog = spyConsole(logs);
      await runCli(
        [rulesCommand.command],
        ["node", "gitface", "rules", "resolve", targetDir, "--json-envelope"],
      );
      restoreLog();

      const output = stripAnsi(logs.join("\n")).trim();
      const parsed = JSON.parse(output) as {
        status: string;
        code: string;
        data: {
          result: string;
          directory: string;
          matchedRule: null;
          profileExists: null;
        };
        meta: { schemaVersion: string; durationMs: number; traceId: string };
      };
      expect(parsed.status).toBe("success");
      expect(parsed.code).toBe("RULE_RESOLVE_UNMATCHED");
      expect(parsed.data).toEqual({
        result: "unmatched",
        directory: `${targetDir}${path.sep}`,
        matchedRule: null,
        profileExists: null,
      });
      expect(parsed.meta.schemaVersion).toBe("1.0.0");
      expect(parsed.meta.durationMs).toBeGreaterThanOrEqual(0);
      expect(parsed.meta.traceId.length).toBeGreaterThan(0);
      expect(process.exitCode).toBeUndefined();
    } finally {
      process.chdir(originalCwd);
      process.argv = originalArgv;
      process.env.HOME = originalHome;
      if (originalXdg === undefined) {
        delete process.env.XDG_CONFIG_HOME;
      } else {
        process.env.XDG_CONFIG_HOME = originalXdg;
      }
      process.exitCode = originalExitCode;
      await safeRemove(tmpRoot);
    }
  });

  test("returns exit code 1 in strict mode when no rule matches target directory", async () => {
    const originalXdg = process.env.XDG_CONFIG_HOME;
    const originalHome = process.env.HOME;
    const originalArgv = process.argv.slice();
    const originalExitCode = process.exitCode;
    const originalCwd = process.cwd();
    const tmpRootRaw = await fs.mkdtemp(
      path.join(os.tmpdir(), "gitface-rules-resolve-strict-unmatched-"),
    );
    const tmpRoot = await fs.realpath(tmpRootRaw);
    const homeDir = path.join(tmpRoot, "home");
    const configDir = path.join(tmpRoot, "config");
    const targetDir = path.join(homeDir, "personal");
    const logs: string[] = [];

    await fs.mkdir(homeDir, { recursive: true });
    await fs.mkdir(configDir, { recursive: true });
    await fs.mkdir(targetDir, { recursive: true });

    process.env.HOME = homeDir;
    process.env.XDG_CONFIG_HOME = configDir;

    try {
      process.chdir(homeDir);
      const restoreLog = spyConsole(logs);
      await runCli(
        [rulesCommand.command],
        ["node", "gitface", "rules", "resolve", targetDir, "--strict", "--json"],
      );
      restoreLog();

      const output = stripAnsi(logs.join("\n")).trim();
      const parsed = JSON.parse(output) as {
        status: string;
        directory: string;
        matchedRule: null;
        profileExists: null;
      };
      expect(parsed).toEqual({
        status: "unmatched",
        directory: `${targetDir}${path.sep}`,
        matchedRule: null,
        profileExists: null,
      });
      expect(process.exitCode).toBe(1);
    } finally {
      process.chdir(originalCwd);
      process.argv = originalArgv;
      process.env.HOME = originalHome;
      if (originalXdg === undefined) {
        delete process.env.XDG_CONFIG_HOME;
      } else {
        process.env.XDG_CONFIG_HOME = originalXdg;
      }
      process.exitCode = originalExitCode;
      await safeRemove(tmpRoot);
    }
  });

  test("returns exit code 1 in strict mode when matched profile does not exist", async () => {
    const originalXdg = process.env.XDG_CONFIG_HOME;
    const originalHome = process.env.HOME;
    const originalArgv = process.argv.slice();
    const originalExitCode = process.exitCode;
    const originalCwd = process.cwd();
    const tmpRootRaw = await fs.mkdtemp(
      path.join(os.tmpdir(), "gitface-rules-resolve-strict-missing-profile-"),
    );
    const tmpRoot = await fs.realpath(tmpRootRaw);
    const homeDir = path.join(tmpRoot, "home");
    const configDir = path.join(tmpRoot, "config");
    const ruleDir = path.join(homeDir, "work");
    const repoDir = path.join(ruleDir, "repo");
    const logs: string[] = [];

    await fs.mkdir(homeDir, { recursive: true });
    await fs.mkdir(configDir, { recursive: true });
    await fs.mkdir(ruleDir, { recursive: true });
    await fs.mkdir(repoDir, { recursive: true });

    process.env.HOME = homeDir;
    process.env.XDG_CONFIG_HOME = configDir;

    try {
      process.chdir(homeDir);
      const service = ProfileService.create();
      await service.createProfile({
        name: "stale-profile",
        gitName: "Stale User",
        email: "stale@example.com",
      });

      await runCli(
        [rulesCommand.command],
        ["node", "gitface", "rules", "add", ruleDir, "stale-profile"],
      );
      await service.removeProfile("stale-profile");

      const restoreLog = spyConsole(logs);
      await runCli(
        [rulesCommand.command],
        ["node", "gitface", "rules", "resolve", repoDir, "--strict", "--json"],
      );
      restoreLog();

      const output = stripAnsi(logs.join("\n")).trim();
      const parsed = JSON.parse(output) as {
        status: string;
        directory: string;
        matchedRule: {
          directory: string;
          profileName: string;
        };
        profileExists: boolean;
      };
      expect(parsed).toEqual({
        status: "matched",
        directory: `${repoDir}${path.sep}`,
        matchedRule: {
          directory: `${ruleDir}${path.sep}`,
          profileName: "stale-profile",
        },
        profileExists: false,
      });
      expect(process.exitCode).toBe(1);
    } finally {
      process.chdir(originalCwd);
      process.argv = originalArgv;
      process.env.HOME = originalHome;
      if (originalXdg === undefined) {
        delete process.env.XDG_CONFIG_HOME;
      } else {
        process.env.XDG_CONFIG_HOME = originalXdg;
      }
      process.exitCode = originalExitCode;
      await safeRemove(tmpRoot);
    }
  });

  test("applies matched rule profile to local scope with --json", async () => {
    const originalXdg = process.env.XDG_CONFIG_HOME;
    const originalHome = process.env.HOME;
    const originalArgv = process.argv.slice();
    const originalExitCode = process.exitCode;
    const originalCwd = process.cwd();
    const tmpRootRaw = await fs.mkdtemp(path.join(os.tmpdir(), "gitface-rules-apply-json-"));
    const tmpRoot = await fs.realpath(tmpRootRaw);
    const homeDir = path.join(tmpRoot, "home");
    const configDir = path.join(tmpRoot, "config");
    const ruleDir = path.join(homeDir, "work");
    const repoDir = path.join(ruleDir, "repo");
    const logs: string[] = [];

    await fs.mkdir(homeDir, { recursive: true });
    await fs.mkdir(configDir, { recursive: true });
    await fs.mkdir(ruleDir, { recursive: true });
    await fs.mkdir(repoDir, { recursive: true });

    process.env.HOME = homeDir;
    process.env.XDG_CONFIG_HOME = configDir;

    try {
      process.chdir(homeDir);
      const service = ProfileService.create();
      await service.createProfile({
        name: "rule-profile",
        gitName: "Rule User",
        email: "rule@example.com",
      });
      await runCli(
        [rulesCommand.command],
        ["node", "gitface", "rules", "add", ruleDir, "rule-profile"],
      );

      const git = simpleGit({ baseDir: repoDir });
      await git.init();
      await git.addConfig("user.name", "Legacy User");
      await git.addConfig("user.email", "legacy@example.com");

      const restoreLog = spyConsole(logs);
      await runCli(
        [rulesCommand.command],
        ["node", "gitface", "rules", "apply", repoDir, "--json"],
      );
      restoreLog();

      const output = stripAnsi(logs.join("\n")).trim();
      const parsed = JSON.parse(output) as {
        status: string;
        directory: string;
        scope: string;
        matchedRule: {
          directory: string;
          profileName: string;
        };
        profile: {
          name: string;
          gitName: string;
          email: string;
          signingKey: string | null;
        };
      };
      expect(parsed).toEqual({
        status: "applied",
        directory: `${repoDir}${path.sep}`,
        scope: "local",
        matchedRule: {
          directory: `${ruleDir}${path.sep}`,
          profileName: "rule-profile",
        },
        profile: {
          name: "rule-profile",
          gitName: "Rule User",
          email: "rule@example.com",
          signingKey: null,
        },
      });

      const localConfig = await git.listConfig();
      expect(localConfig.all["user.name"]).toBe("Rule User");
      expect(localConfig.all["user.email"]).toBe("rule@example.com");
    } finally {
      process.chdir(originalCwd);
      process.argv = originalArgv;
      process.env.HOME = originalHome;
      if (originalXdg === undefined) {
        delete process.env.XDG_CONFIG_HOME;
      } else {
        process.env.XDG_CONFIG_HOME = originalXdg;
      }
      process.exitCode = originalExitCode;
      await safeRemove(tmpRoot);
    }
  });

  test("applies matched rule profile with --json-envelope", async () => {
    const originalXdg = process.env.XDG_CONFIG_HOME;
    const originalHome = process.env.HOME;
    const originalArgv = process.argv.slice();
    const originalExitCode = process.exitCode;
    const originalCwd = process.cwd();
    const tmpRootRaw = await fs.mkdtemp(path.join(os.tmpdir(), "gitface-rules-apply-envelope-"));
    const tmpRoot = await fs.realpath(tmpRootRaw);
    const homeDir = path.join(tmpRoot, "home");
    const configDir = path.join(tmpRoot, "config");
    const ruleDir = path.join(homeDir, "work");
    const repoDir = path.join(ruleDir, "repo");
    const logs: string[] = [];

    await fs.mkdir(homeDir, { recursive: true });
    await fs.mkdir(configDir, { recursive: true });
    await fs.mkdir(ruleDir, { recursive: true });
    await fs.mkdir(repoDir, { recursive: true });

    process.env.HOME = homeDir;
    process.env.XDG_CONFIG_HOME = configDir;

    try {
      process.chdir(homeDir);
      const service = ProfileService.create();
      await service.createProfile({
        name: "rule-profile",
        gitName: "Rule User",
        email: "rule@example.com",
      });
      await runCli(
        [rulesCommand.command],
        ["node", "gitface", "rules", "add", ruleDir, "rule-profile"],
      );

      const git = simpleGit({ baseDir: repoDir });
      await git.init();
      await git.addConfig("user.name", "Legacy User");
      await git.addConfig("user.email", "legacy@example.com");

      const restoreLog = spyConsole(logs);
      await runCli(
        [rulesCommand.command],
        ["node", "gitface", "rules", "apply", repoDir, "--json-envelope"],
      );
      restoreLog();

      const output = stripAnsi(logs.join("\n")).trim();
      const parsed = JSON.parse(output) as {
        status: string;
        code: string;
        message: string;
        data: {
          result: string;
          resolution: string;
          directory: string;
          scope: string;
          matchedRule: {
            directory: string;
            profileName: string;
          };
          fallbackProfileName: string | null;
          profile: {
            name: string;
            gitName: string;
            email: string;
            signingKey: string | null;
          };
          hasChanges: boolean;
          changes: Array<{ key: string; action: string }>;
        };
        errors: unknown[];
        meta: {
          schemaVersion: string;
          durationMs: number;
          traceId: string;
        };
      };

      expect(parsed.status).toBe("success");
      expect(parsed.code).toBe("RULE_APPLY_APPLIED");
      expect(parsed.data.result).toBe("applied");
      expect(parsed.data.resolution).toBe("matched");
      expect(parsed.data.directory).toBe(`${repoDir}${path.sep}`);
      expect(parsed.data.scope).toBe("local");
      expect(parsed.data.matchedRule).toEqual({
        directory: `${ruleDir}${path.sep}`,
        profileName: "rule-profile",
      });
      expect(parsed.data.fallbackProfileName).toBeNull();
      expect(parsed.data.profile.name).toBe("rule-profile");
      expect(parsed.data.hasChanges).toBe(true);
      expect(parsed.data.changes.some((item) => item.key === "user.name")).toBe(true);
      expect(parsed.errors).toEqual([]);
      expect(parsed.meta.schemaVersion).toBe("1.0.0");
      expect(parsed.meta.durationMs).toBeGreaterThanOrEqual(0);
      expect(parsed.meta.traceId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );

      const localConfig = await git.listConfig();
      expect(localConfig.all["user.name"]).toBe("Rule User");
      expect(localConfig.all["user.email"]).toBe("rule@example.com");
    } finally {
      process.chdir(originalCwd);
      process.argv = originalArgv;
      process.env.HOME = originalHome;
      if (originalXdg === undefined) {
        delete process.env.XDG_CONFIG_HOME;
      } else {
        process.env.XDG_CONFIG_HOME = originalXdg;
      }
      process.exitCode = originalExitCode;
      await safeRemove(tmpRoot);
    }
  });

  test("applies matched rule without mutating process cwd", async () => {
    const originalXdg = process.env.XDG_CONFIG_HOME;
    const originalHome = process.env.HOME;
    const originalArgv = process.argv.slice();
    const originalExitCode = process.exitCode;
    const originalCwd = process.cwd();
    const tmpRootRaw = await fs.mkdtemp(path.join(os.tmpdir(), "gitface-rules-apply-cwd-stable-"));
    const tmpRoot = await fs.realpath(tmpRootRaw);
    const homeDir = path.join(tmpRoot, "home");
    const configDir = path.join(tmpRoot, "config");
    const workspaceDir = path.join(homeDir, "workspace");
    const ruleDir = path.join(workspaceDir, "work");
    const repoDir = path.join(ruleDir, "repo");

    await fs.mkdir(homeDir, { recursive: true });
    await fs.mkdir(configDir, { recursive: true });
    await fs.mkdir(ruleDir, { recursive: true });
    await fs.mkdir(repoDir, { recursive: true });

    process.env.HOME = homeDir;
    process.env.XDG_CONFIG_HOME = configDir;

    try {
      process.chdir(workspaceDir);
      const service = ProfileService.create();
      await service.createProfile({
        name: "rule-profile",
        gitName: "Rule User",
        email: "rule@example.com",
      });
      await runCli(
        [rulesCommand.command],
        ["node", "gitface", "rules", "add", ruleDir, "rule-profile"],
      );

      const git = simpleGit({ baseDir: repoDir });
      await git.init();

      const cwdBefore = process.cwd();
      await runCli([rulesCommand.command], ["node", "gitface", "rules", "apply", repoDir]);
      const cwdAfter = process.cwd();

      expect(cwdAfter).toBe(cwdBefore);
      const localConfig = await git.listConfig();
      expect(localConfig.all["user.name"]).toBe("Rule User");
      expect(localConfig.all["user.email"]).toBe("rule@example.com");
    } finally {
      process.chdir(originalCwd);
      process.argv = originalArgv;
      process.env.HOME = originalHome;
      if (originalXdg === undefined) {
        delete process.env.XDG_CONFIG_HOME;
      } else {
        process.env.XDG_CONFIG_HOME = originalXdg;
      }
      process.exitCode = originalExitCode;
      await safeRemove(tmpRoot);
    }
  });

  test("previews apply with --dry-run --json without mutating local git config", async () => {
    const originalXdg = process.env.XDG_CONFIG_HOME;
    const originalHome = process.env.HOME;
    const originalArgv = process.argv.slice();
    const originalExitCode = process.exitCode;
    const originalCwd = process.cwd();
    const tmpRootRaw = await fs.mkdtemp(
      path.join(os.tmpdir(), "gitface-rules-apply-dry-run-json-"),
    );
    const tmpRoot = await fs.realpath(tmpRootRaw);
    const homeDir = path.join(tmpRoot, "home");
    const configDir = path.join(tmpRoot, "config");
    const ruleDir = path.join(homeDir, "work");
    const repoDir = path.join(ruleDir, "repo");
    const logs: string[] = [];

    await fs.mkdir(homeDir, { recursive: true });
    await fs.mkdir(configDir, { recursive: true });
    await fs.mkdir(ruleDir, { recursive: true });
    await fs.mkdir(repoDir, { recursive: true });

    process.env.HOME = homeDir;
    process.env.XDG_CONFIG_HOME = configDir;

    try {
      process.chdir(homeDir);
      const service = ProfileService.create();
      await service.createProfile({
        name: "rule-profile",
        gitName: "Rule User",
        email: "rule@example.com",
      });
      await runCli(
        [rulesCommand.command],
        ["node", "gitface", "rules", "add", ruleDir, "rule-profile"],
      );

      const git = simpleGit({ baseDir: repoDir });
      await git.init();
      await git.addConfig("user.name", "Current User");
      await git.addConfig("user.email", "current@example.com");

      const restoreLog = spyConsole(logs);
      await runCli(
        [rulesCommand.command],
        ["node", "gitface", "rules", "apply", repoDir, "--dry-run", "--json"],
      );
      restoreLog();

      const output = stripAnsi(logs.join("\n")).trim();
      const parsed = JSON.parse(output) as {
        status: string;
        scope: string;
        hasChanges: boolean;
        changes: Array<{ key: string; action: string }>;
      };
      expect(parsed.status).toBe("dry-run");
      expect(parsed.scope).toBe("local");
      expect(parsed.hasChanges).toBe(true);
      expect(parsed.changes.some((item) => item.key === "user.name")).toBe(true);
      expect(
        parsed.changes.some(
          (item) => item.key === "user.signingkey" && item.action === "unchanged",
        ),
      ).toBe(false);

      const localConfig = await git.listConfig();
      expect(localConfig.all["user.name"]).toBe("Current User");
      expect(localConfig.all["user.email"]).toBe("current@example.com");
    } finally {
      process.chdir(originalCwd);
      process.argv = originalArgv;
      process.env.HOME = originalHome;
      if (originalXdg === undefined) {
        delete process.env.XDG_CONFIG_HOME;
      } else {
        process.env.XDG_CONFIG_HOME = originalXdg;
      }
      process.exitCode = originalExitCode;
      await safeRemove(tmpRoot);
    }
  });

  test("returns unmatched and exit code 1 for rules apply --strict when no rule matches", async () => {
    const originalXdg = process.env.XDG_CONFIG_HOME;
    const originalHome = process.env.HOME;
    const originalArgv = process.argv.slice();
    const originalExitCode = process.exitCode;
    const originalCwd = process.cwd();
    const tmpRootRaw = await fs.mkdtemp(
      path.join(os.tmpdir(), "gitface-rules-apply-strict-unmatched-"),
    );
    const tmpRoot = await fs.realpath(tmpRootRaw);
    const homeDir = path.join(tmpRoot, "home");
    const configDir = path.join(tmpRoot, "config");
    const targetDir = path.join(homeDir, "personal");
    const logs: string[] = [];

    await fs.mkdir(homeDir, { recursive: true });
    await fs.mkdir(configDir, { recursive: true });
    await fs.mkdir(targetDir, { recursive: true });

    process.env.HOME = homeDir;
    process.env.XDG_CONFIG_HOME = configDir;

    try {
      process.chdir(homeDir);
      const restoreLog = spyConsole(logs);
      await runCli(
        [rulesCommand.command],
        ["node", "gitface", "rules", "apply", targetDir, "--strict", "--json"],
      );
      restoreLog();

      const output = stripAnsi(logs.join("\n")).trim();
      const parsed = JSON.parse(output) as {
        status: string;
        directory: string;
        scope: string;
        matchedRule: null;
      };
      expect(parsed).toEqual({
        status: "unmatched",
        directory: `${targetDir}${path.sep}`,
        scope: "local",
        matchedRule: null,
      });
      expect(process.exitCode).toBe(1);
    } finally {
      process.chdir(originalCwd);
      process.argv = originalArgv;
      process.env.HOME = originalHome;
      if (originalXdg === undefined) {
        delete process.env.XDG_CONFIG_HOME;
      } else {
        process.env.XDG_CONFIG_HOME = originalXdg;
      }
      process.exitCode = originalExitCode;
      await safeRemove(tmpRoot);
    }
  });

  test("returns envelope error for rules apply --json-envelope invalid scope", async () => {
    const originalXdg = process.env.XDG_CONFIG_HOME;
    const originalHome = process.env.HOME;
    const originalArgv = process.argv.slice();
    const originalExitCode = process.exitCode;
    const originalCwd = process.cwd();
    const tmpRootRaw = await fs.mkdtemp(
      path.join(os.tmpdir(), "gitface-rules-apply-envelope-scope-error-"),
    );
    const tmpRoot = await fs.realpath(tmpRootRaw);
    const homeDir = path.join(tmpRoot, "home");
    const configDir = path.join(tmpRoot, "config");
    const targetDir = path.join(homeDir, "personal");
    const logs: string[] = [];

    await fs.mkdir(homeDir, { recursive: true });
    await fs.mkdir(configDir, { recursive: true });
    await fs.mkdir(targetDir, { recursive: true });

    process.env.HOME = homeDir;
    process.env.XDG_CONFIG_HOME = configDir;

    try {
      process.chdir(homeDir);
      const restoreLog = spyConsole(logs);
      await runCli(
        [rulesCommand.command],
        ["node", "gitface", "rules", "apply", targetDir, "--scope", "workspace", "--json-envelope"],
      );
      restoreLog();

      const output = stripAnsi(logs.join("\n")).trim();
      const parsed = JSON.parse(output) as {
        status: string;
        code: string;
        message: string;
        data: null;
        errors: Array<{ code: string; message: string }>;
        meta: {
          schemaVersion: string;
          durationMs: number;
          traceId: string;
        };
      };

      expect(parsed.status).toBe("error");
      expect(parsed.code).toBe("RULE_APPLY_SCOPE_INVALID");
      expect(parsed.message).toContain("Scope must be one of");
      expect(parsed.data).toBeNull();
      expect(parsed.errors).toEqual([
        {
          code: "RULE_APPLY_SCOPE_INVALID",
          message: "Scope must be one of: local, global, system.",
        },
      ]);
      expect(parsed.meta.schemaVersion).toBe("1.0.0");
      expect(parsed.meta.durationMs).toBeGreaterThanOrEqual(0);
      expect(parsed.meta.traceId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      expect(process.exitCode).toBe(1);
    } finally {
      process.chdir(originalCwd);
      process.argv = originalArgv;
      process.env.HOME = originalHome;
      if (originalXdg === undefined) {
        delete process.env.XDG_CONFIG_HOME;
      } else {
        process.env.XDG_CONFIG_HOME = originalXdg;
      }
      process.exitCode = originalExitCode;
      await safeRemove(tmpRoot);
    }
  });

  test("applies fallback profile when no rule matches target directory", async () => {
    const originalXdg = process.env.XDG_CONFIG_HOME;
    const originalHome = process.env.HOME;
    const originalArgv = process.argv.slice();
    const originalExitCode = process.exitCode;
    const originalCwd = process.cwd();
    const tmpRootRaw = await fs.mkdtemp(path.join(os.tmpdir(), "gitface-rules-apply-fallback-"));
    const tmpRoot = await fs.realpath(tmpRootRaw);
    const homeDir = path.join(tmpRoot, "home");
    const configDir = path.join(tmpRoot, "config");
    const targetDir = path.join(homeDir, "sandbox");
    const logs: string[] = [];

    await fs.mkdir(homeDir, { recursive: true });
    await fs.mkdir(configDir, { recursive: true });
    await fs.mkdir(targetDir, { recursive: true });

    process.env.HOME = homeDir;
    process.env.XDG_CONFIG_HOME = configDir;

    try {
      process.chdir(homeDir);
      const service = ProfileService.create();
      await service.createProfile({
        name: "fallback-work",
        gitName: "Fallback User",
        email: "fallback@example.com",
      });

      const git = simpleGit({ baseDir: targetDir });
      await git.init();

      const restoreLog = spyConsole(logs);
      await runCli(
        [rulesCommand.command],
        [
          "node",
          "gitface",
          "rules",
          "apply",
          targetDir,
          "--strict",
          "--fallback-profile",
          "fallback-work",
          "--json",
        ],
      );
      restoreLog();

      const output = stripAnsi(logs.join("\n")).trim();
      const parsed = JSON.parse(output) as {
        status: string;
        resolution: string;
        directory: string;
        scope: string;
        matchedRule: null;
        fallbackProfileName: string;
        profile: {
          name: string;
          gitName: string;
          email: string;
          signingKey: string | null;
        };
      };
      expect(parsed.status).toBe("applied");
      expect(parsed.resolution).toBe("fallback");
      expect(parsed.directory).toBe(`${targetDir}${path.sep}`);
      expect(parsed.scope).toBe("local");
      expect(parsed.matchedRule).toBeNull();
      expect(parsed.fallbackProfileName).toBe("fallback-work");
      expect(parsed.profile.name).toBe("fallback-work");
      expect(process.exitCode ?? 0).toBe(0);

      const config = await git.listConfig();
      expect(config.all["user.name"]).toBe("Fallback User");
      expect(config.all["user.email"]).toBe("fallback@example.com");
    } finally {
      process.chdir(originalCwd);
      process.argv = originalArgv;
      process.env.HOME = originalHome;
      if (originalXdg === undefined) {
        delete process.env.XDG_CONFIG_HOME;
      } else {
        process.env.XDG_CONFIG_HOME = originalXdg;
      }
      process.exitCode = originalExitCode;
      await safeRemove(tmpRoot);
    }
  });

  test("returns error when fallback profile does not exist", async () => {
    const originalXdg = process.env.XDG_CONFIG_HOME;
    const originalHome = process.env.HOME;
    const originalArgv = process.argv.slice();
    const originalExitCode = process.exitCode;
    const originalCwd = process.cwd();
    const tmpRootRaw = await fs.mkdtemp(
      path.join(os.tmpdir(), "gitface-rules-apply-fallback-missing-"),
    );
    const tmpRoot = await fs.realpath(tmpRootRaw);
    const homeDir = path.join(tmpRoot, "home");
    const configDir = path.join(tmpRoot, "config");
    const targetDir = path.join(homeDir, "sandbox");
    const logs: string[] = [];

    await fs.mkdir(homeDir, { recursive: true });
    await fs.mkdir(configDir, { recursive: true });
    await fs.mkdir(targetDir, { recursive: true });

    process.env.HOME = homeDir;
    process.env.XDG_CONFIG_HOME = configDir;

    try {
      process.chdir(homeDir);

      const restoreLog = spyConsole(logs);
      await runCli(
        [rulesCommand.command],
        [
          "node",
          "gitface",
          "rules",
          "apply",
          targetDir,
          "--fallback-profile",
          "not-exist",
          "--json",
        ],
      );
      restoreLog();

      const output = stripAnsi(logs.join("\n")).trim();
      const parsed = JSON.parse(output) as {
        status: string;
        directory: string;
        reason: string;
      };
      expect(parsed.status).toBe("error");
      expect(parsed.directory).toBe(`${targetDir}${path.sep}`);
      expect(parsed.reason).toContain("not-exist");
      expect(process.exitCode).toBe(1);
    } finally {
      process.chdir(originalCwd);
      process.argv = originalArgv;
      process.env.HOME = originalHome;
      if (originalXdg === undefined) {
        delete process.env.XDG_CONFIG_HOME;
      } else {
        process.env.XDG_CONFIG_HOME = originalXdg;
      }
      process.exitCode = originalExitCode;
      await safeRemove(tmpRoot);
    }
  });

  test("returns error when rules apply matches missing profile", async () => {
    const originalXdg = process.env.XDG_CONFIG_HOME;
    const originalHome = process.env.HOME;
    const originalArgv = process.argv.slice();
    const originalExitCode = process.exitCode;
    const originalCwd = process.cwd();
    const tmpRootRaw = await fs.mkdtemp(
      path.join(os.tmpdir(), "gitface-rules-apply-missing-profile-"),
    );
    const tmpRoot = await fs.realpath(tmpRootRaw);
    const homeDir = path.join(tmpRoot, "home");
    const configDir = path.join(tmpRoot, "config");
    const ruleDir = path.join(homeDir, "work");
    const repoDir = path.join(ruleDir, "repo");
    const logs: string[] = [];

    await fs.mkdir(homeDir, { recursive: true });
    await fs.mkdir(configDir, { recursive: true });
    await fs.mkdir(ruleDir, { recursive: true });
    await fs.mkdir(repoDir, { recursive: true });

    process.env.HOME = homeDir;
    process.env.XDG_CONFIG_HOME = configDir;

    try {
      process.chdir(homeDir);
      const service = ProfileService.create();
      await service.createProfile({
        name: "stale-profile",
        gitName: "Stale User",
        email: "stale@example.com",
      });
      await runCli(
        [rulesCommand.command],
        ["node", "gitface", "rules", "add", ruleDir, "stale-profile"],
      );
      await service.removeProfile("stale-profile");

      const restoreLog = spyConsole(logs);
      await runCli(
        [rulesCommand.command],
        ["node", "gitface", "rules", "apply", repoDir, "--json"],
      );
      restoreLog();

      const output = stripAnsi(logs.join("\n")).trim();
      const parsed = JSON.parse(output) as {
        status: string;
        directory: string;
        reason: string;
      };
      expect(parsed.status).toBe("error");
      expect(parsed.directory).toBe(`${repoDir}${path.sep}`);
      expect(parsed.reason).toContain("stale-profile");
      expect(process.exitCode).toBe(1);
    } finally {
      process.chdir(originalCwd);
      process.argv = originalArgv;
      process.env.HOME = originalHome;
      if (originalXdg === undefined) {
        delete process.env.XDG_CONFIG_HOME;
      } else {
        process.env.XDG_CONFIG_HOME = originalXdg;
      }
      process.exitCode = originalExitCode;
      await safeRemove(tmpRoot);
    }
  });

  test("reports healthy rules with rules doctor --json", async () => {
    const originalXdg = process.env.XDG_CONFIG_HOME;
    const originalHome = process.env.HOME;
    const originalArgv = process.argv.slice();
    const originalExitCode = process.exitCode;
    const originalCwd = process.cwd();
    const tmpRootRaw = await fs.mkdtemp(path.join(os.tmpdir(), "gitface-rules-doctor-ok-"));
    const tmpRoot = await fs.realpath(tmpRootRaw);
    const homeDir = path.join(tmpRoot, "home");
    const configDir = path.join(tmpRoot, "config");
    const ruleDir = path.join(homeDir, "work");
    const logs: string[] = [];

    await fs.mkdir(homeDir, { recursive: true });
    await fs.mkdir(configDir, { recursive: true });
    await fs.mkdir(ruleDir, { recursive: true });

    process.env.HOME = homeDir;
    process.env.XDG_CONFIG_HOME = configDir;

    try {
      process.chdir(homeDir);
      const service = ProfileService.create();
      await service.createProfile({
        name: "doctor-profile",
        gitName: "Doctor User",
        email: "doctor@example.com",
      });
      await runCli(
        [rulesCommand.command],
        ["node", "gitface", "rules", "add", ruleDir, "doctor-profile"],
      );

      const restoreLog = spyConsole(logs);
      await runCli([rulesCommand.command], ["node", "gitface", "rules", "doctor", "--json"]);
      restoreLog();

      const output = stripAnsi(logs.join("\n")).trim();
      const parsed = JSON.parse(output) as {
        status: string;
        strict: boolean;
        summary: {
          total: number;
          pass: number;
          warn: number;
          fail: number;
        };
        metrics: {
          concurrency: number;
          scanned: number;
          uniqueProfilesChecked: number;
          uniqueDirectoriesChecked: number;
          scanDurationMs: number;
        };
      };
      expect(parsed.status).toBe("ok");
      expect(parsed.strict).toBe(false);
      expect(parsed.summary).toEqual({
        total: 1,
        pass: 1,
        warn: 0,
        fail: 0,
      });
      expect(parsed.metrics.scanned).toBe(1);
      expect(parsed.metrics.concurrency).toBeGreaterThanOrEqual(1);
      expect(parsed.metrics.uniqueProfilesChecked).toBe(1);
      expect(parsed.metrics.uniqueDirectoriesChecked).toBe(1);
      expect(parsed.metrics.scanDurationMs).toBeGreaterThanOrEqual(0);
      expect(process.exitCode).toBeUndefined();
    } finally {
      process.chdir(originalCwd);
      process.argv = originalArgv;
      process.env.HOME = originalHome;
      if (originalXdg === undefined) {
        delete process.env.XDG_CONFIG_HOME;
      } else {
        process.env.XDG_CONFIG_HOME = originalXdg;
      }
      process.exitCode = originalExitCode;
      await safeRemove(tmpRoot);
    }
  });

  test("reports warn for missing directory and fails in strict mode", async () => {
    const originalXdg = process.env.XDG_CONFIG_HOME;
    const originalHome = process.env.HOME;
    const originalArgv = process.argv.slice();
    const originalExitCode = process.exitCode;
    const originalCwd = process.cwd();
    const tmpRootRaw = await fs.mkdtemp(path.join(os.tmpdir(), "gitface-rules-doctor-warn-"));
    const tmpRoot = await fs.realpath(tmpRootRaw);
    const homeDir = path.join(tmpRoot, "home");
    const configDir = path.join(tmpRoot, "config");
    const ruleDir = path.join(homeDir, "legacy");
    const logs: string[] = [];

    await fs.mkdir(homeDir, { recursive: true });
    await fs.mkdir(configDir, { recursive: true });
    await fs.mkdir(ruleDir, { recursive: true });

    process.env.HOME = homeDir;
    process.env.XDG_CONFIG_HOME = configDir;

    try {
      process.chdir(homeDir);
      const service = ProfileService.create();
      await service.createProfile({
        name: "warn-profile",
        gitName: "Warn User",
        email: "warn@example.com",
      });
      await runCli(
        [rulesCommand.command],
        ["node", "gitface", "rules", "add", ruleDir, "warn-profile"],
      );
      await safeRemove(ruleDir);

      const restoreLog = spyConsole(logs);
      await runCli([rulesCommand.command], ["node", "gitface", "rules", "doctor", "--json"]);
      restoreLog();

      const output = stripAnsi(logs.join("\n")).trim();
      const parsed = JSON.parse(output) as {
        status: string;
        summary: { total: number; pass: number; warn: number; fail: number };
        metrics: {
          concurrency: number;
          scanned: number;
          uniqueProfilesChecked: number;
          uniqueDirectoriesChecked: number;
          scanDurationMs: number;
        };
      };
      expect(parsed.status).toBe("issues");
      expect(parsed.summary).toEqual({
        total: 1,
        pass: 0,
        warn: 1,
        fail: 0,
      });
      expect(parsed.metrics.scanned).toBe(1);
      expect(parsed.metrics.uniqueProfilesChecked).toBe(1);
      expect(parsed.metrics.uniqueDirectoriesChecked).toBe(1);
      expect(parsed.metrics.scanDurationMs).toBeGreaterThanOrEqual(0);
      expect(process.exitCode).toBeUndefined();

      logs.length = 0;
      process.exitCode = undefined;
      const restoreLogStrict = spyConsole(logs);
      await runCli(
        [rulesCommand.command],
        ["node", "gitface", "rules", "doctor", "--strict", "--json"],
      );
      restoreLogStrict();

      const strictOutput = stripAnsi(logs.join("\n")).trim();
      const strictParsed = JSON.parse(strictOutput) as {
        status: string;
        strict: boolean;
      };
      expect(strictParsed.status).toBe("issues");
      expect(strictParsed.strict).toBe(true);
      expect(process.exitCode).toBe(1);
    } finally {
      process.chdir(originalCwd);
      process.argv = originalArgv;
      process.env.HOME = originalHome;
      if (originalXdg === undefined) {
        delete process.env.XDG_CONFIG_HOME;
      } else {
        process.env.XDG_CONFIG_HOME = originalXdg;
      }
      process.exitCode = originalExitCode;
      await safeRemove(tmpRoot);
    }
  });

  test("reports fail and exit code 1 when rule profile is missing", async () => {
    const originalXdg = process.env.XDG_CONFIG_HOME;
    const originalHome = process.env.HOME;
    const originalArgv = process.argv.slice();
    const originalExitCode = process.exitCode;
    const originalCwd = process.cwd();
    const tmpRootRaw = await fs.mkdtemp(path.join(os.tmpdir(), "gitface-rules-doctor-fail-"));
    const tmpRoot = await fs.realpath(tmpRootRaw);
    const homeDir = path.join(tmpRoot, "home");
    const configDir = path.join(tmpRoot, "config");
    const ruleDir = path.join(homeDir, "stale");
    const logs: string[] = [];

    await fs.mkdir(homeDir, { recursive: true });
    await fs.mkdir(configDir, { recursive: true });
    await fs.mkdir(ruleDir, { recursive: true });

    process.env.HOME = homeDir;
    process.env.XDG_CONFIG_HOME = configDir;

    try {
      process.chdir(homeDir);
      const service = ProfileService.create();
      await service.createProfile({
        name: "stale-profile",
        gitName: "Stale User",
        email: "stale@example.com",
      });
      await runCli(
        [rulesCommand.command],
        ["node", "gitface", "rules", "add", ruleDir, "stale-profile"],
      );
      await service.removeProfile("stale-profile");

      const restoreLog = spyConsole(logs);
      await runCli([rulesCommand.command], ["node", "gitface", "rules", "doctor", "--json"]);
      restoreLog();

      const output = stripAnsi(logs.join("\n")).trim();
      const parsed = JSON.parse(output) as {
        status: string;
        summary: { total: number; pass: number; warn: number; fail: number };
        results: Array<{
          profileName: string;
          status: string;
          profileExists: boolean;
        }>;
      };
      expect(parsed.status).toBe("issues");
      expect(parsed.summary).toEqual({
        total: 1,
        pass: 0,
        warn: 0,
        fail: 1,
      });
      expect(parsed.results[0]).toMatchObject({
        profileName: "stale-profile",
        status: "fail",
        profileExists: false,
      });
      expect(process.exitCode).toBe(1);
    } finally {
      process.chdir(originalCwd);
      process.argv = originalArgv;
      process.env.HOME = originalHome;
      if (originalXdg === undefined) {
        delete process.env.XDG_CONFIG_HOME;
      } else {
        process.env.XDG_CONFIG_HOME = originalXdg;
      }
      process.exitCode = originalExitCode;
      await safeRemove(tmpRoot);
    }
  });

  test("returns json error when doctor concurrency is invalid", async () => {
    const originalArgv = process.argv.slice();
    const originalExitCode = process.exitCode;
    const logs: string[] = [];

    try {
      const restoreLog = spyConsole(logs);
      await runCli(
        [rulesCommand.command],
        ["node", "gitface", "rules", "doctor", "--json", "--concurrency", "0"],
      );
      restoreLog();

      const output = stripAnsi(logs.join("\n")).trim();
      const parsed = JSON.parse(output) as {
        status: string;
        reason: string;
      };
      expect(parsed).toEqual({
        status: "error",
        reason: "Concurrency must be a positive integer.",
      });
      expect(process.exitCode).toBe(1);
    } finally {
      process.argv = originalArgv;
      process.exitCode = originalExitCode;
    }
  });

  test("prune --dry-run --json reports stale rules without mutating config", async () => {
    const originalXdg = process.env.XDG_CONFIG_HOME;
    const originalHome = process.env.HOME;
    const originalArgv = process.argv.slice();
    const originalExitCode = process.exitCode;
    const originalCwd = process.cwd();
    const tmpRootRaw = await fs.mkdtemp(path.join(os.tmpdir(), "gitface-rules-prune-dry-run-"));
    const tmpRoot = await fs.realpath(tmpRootRaw);
    const homeDir = path.join(tmpRoot, "home");
    const configDir = path.join(tmpRoot, "config");
    const healthyDir = path.join(homeDir, "healthy");
    const staleDir = path.join(homeDir, "stale");
    const logs: string[] = [];

    await fs.mkdir(homeDir, { recursive: true });
    await fs.mkdir(configDir, { recursive: true });
    await fs.mkdir(healthyDir, { recursive: true });
    await fs.mkdir(staleDir, { recursive: true });

    process.env.HOME = homeDir;
    process.env.XDG_CONFIG_HOME = configDir;

    try {
      process.chdir(homeDir);
      const service = ProfileService.create();
      await service.createProfile({
        name: "healthy-profile",
        gitName: "Healthy User",
        email: "healthy@example.com",
      });
      await service.createProfile({
        name: "stale-profile",
        gitName: "Stale User",
        email: "stale@example.com",
      });

      await runCli(
        [rulesCommand.command],
        ["node", "gitface", "rules", "add", healthyDir, "healthy-profile"],
      );
      await runCli(
        [rulesCommand.command],
        ["node", "gitface", "rules", "add", staleDir, "stale-profile"],
      );
      await service.removeProfile("stale-profile");

      const restoreLog = spyConsole(logs);
      await runCli(
        [rulesCommand.command],
        ["node", "gitface", "rules", "prune", "--dry-run", "--json"],
      );
      restoreLog();

      const output = stripAnsi(logs.join("\n")).trim();
      const parsed = JSON.parse(output) as {
        status: string;
        dryRun: boolean;
        summary: {
          scanned: number;
          prunable: number;
          pruned: number;
          skipped: number;
        };
        results: Array<{
          directory: string;
          profileName: string;
          status: string;
        }>;
        metrics: {
          concurrency: number;
          scanned: number;
          uniqueProfilesChecked: number;
          uniqueDirectoriesChecked: number;
          scanDurationMs: number;
        };
      };

      expect(parsed.status).toBe("dry-run");
      expect(parsed.dryRun).toBe(true);
      expect(parsed.summary).toEqual({
        scanned: 2,
        prunable: 1,
        pruned: 0,
        skipped: 0,
      });
      expect(parsed.metrics.scanned).toBe(2);
      expect(parsed.metrics.uniqueProfilesChecked).toBe(2);
      expect(parsed.metrics.uniqueDirectoriesChecked).toBe(0);
      expect(parsed.metrics.scanDurationMs).toBeGreaterThanOrEqual(0);
      expect(parsed.results).toEqual([
        {
          directory: `${staleDir}${path.sep}`,
          profileName: "stale-profile",
          profileExists: false,
          status: "candidate",
        },
      ]);

      logs.length = 0;
      const restoreLogRules = spyConsole(logs);
      await runCli([rulesCommand.command], ["node", "gitface", "rules", "list", "--json"]);
      restoreLogRules();
      const rulesOutput = stripAnsi(logs.join("\n")).trim();
      const listedRules = JSON.parse(rulesOutput) as Array<{
        directory: string;
        profileName: string;
      }>;
      expect(listedRules).toContainEqual({
        directory: `${staleDir}${path.sep}`,
        profileName: "stale-profile",
      });
      expect(listedRules).toContainEqual({
        directory: `${healthyDir}${path.sep}`,
        profileName: "healthy-profile",
      });
    } finally {
      process.chdir(originalCwd);
      process.argv = originalArgv;
      process.env.HOME = originalHome;
      if (originalXdg === undefined) {
        delete process.env.XDG_CONFIG_HOME;
      } else {
        process.env.XDG_CONFIG_HOME = originalXdg;
      }
      process.exitCode = originalExitCode;
      await safeRemove(tmpRoot);
    }
  });

  test("returns json error when prune concurrency is invalid", async () => {
    const originalArgv = process.argv.slice();
    const originalExitCode = process.exitCode;
    const logs: string[] = [];

    try {
      const restoreLog = spyConsole(logs);
      await runCli(
        [rulesCommand.command],
        ["node", "gitface", "rules", "prune", "--dry-run", "--json", "--concurrency", "invalid"],
      );
      restoreLog();

      const output = stripAnsi(logs.join("\n")).trim();
      const parsed = JSON.parse(output) as {
        status: string;
        reason: string;
      };
      expect(parsed).toEqual({
        status: "error",
        reason: "Concurrency must be a positive integer.",
      });
      expect(process.exitCode).toBe(1);
    } finally {
      process.argv = originalArgv;
      process.exitCode = originalExitCode;
    }
  });

  test("prune --dry-run --strict --json returns exit code 1 when stale rules are detected", async () => {
    const originalXdg = process.env.XDG_CONFIG_HOME;
    const originalHome = process.env.HOME;
    const originalArgv = process.argv.slice();
    const originalExitCode = process.exitCode;
    const originalCwd = process.cwd();
    const tmpRootRaw = await fs.mkdtemp(
      path.join(os.tmpdir(), "gitface-rules-prune-dry-run-strict-"),
    );
    const tmpRoot = await fs.realpath(tmpRootRaw);
    const homeDir = path.join(tmpRoot, "home");
    const configDir = path.join(tmpRoot, "config");
    const staleDir = path.join(homeDir, "stale");
    const logs: string[] = [];

    await fs.mkdir(homeDir, { recursive: true });
    await fs.mkdir(configDir, { recursive: true });
    await fs.mkdir(staleDir, { recursive: true });

    process.env.HOME = homeDir;
    process.env.XDG_CONFIG_HOME = configDir;

    try {
      process.chdir(homeDir);
      const service = ProfileService.create();
      await service.createProfile({
        name: "stale-profile",
        gitName: "Stale User",
        email: "stale@example.com",
      });

      await runCli(
        [rulesCommand.command],
        ["node", "gitface", "rules", "add", staleDir, "stale-profile"],
      );
      await service.removeProfile("stale-profile");

      const restoreLog = spyConsole(logs);
      await runCli(
        [rulesCommand.command],
        ["node", "gitface", "rules", "prune", "--dry-run", "--strict", "--json"],
      );
      restoreLog();

      const output = stripAnsi(logs.join("\n")).trim();
      const parsed = JSON.parse(output) as {
        status: string;
        dryRun: boolean;
        strict: boolean;
        summary: {
          scanned: number;
          prunable: number;
          pruned: number;
          skipped: number;
        };
      };
      expect(parsed.status).toBe("dry-run");
      expect(parsed.dryRun).toBe(true);
      expect(parsed.strict).toBe(true);
      expect(parsed.summary.prunable).toBe(1);
      expect(process.exitCode).toBe(1);
    } finally {
      process.chdir(originalCwd);
      process.argv = originalArgv;
      process.env.HOME = originalHome;
      if (originalXdg === undefined) {
        delete process.env.XDG_CONFIG_HOME;
      } else {
        process.env.XDG_CONFIG_HOME = originalXdg;
      }
      process.exitCode = originalExitCode;
      await safeRemove(tmpRoot);
    }
  });

  test("prune --json removes stale rules and keeps healthy rules", async () => {
    const originalXdg = process.env.XDG_CONFIG_HOME;
    const originalHome = process.env.HOME;
    const originalArgv = process.argv.slice();
    const originalExitCode = process.exitCode;
    const originalCwd = process.cwd();
    const tmpRootRaw = await fs.mkdtemp(path.join(os.tmpdir(), "gitface-rules-prune-apply-"));
    const tmpRoot = await fs.realpath(tmpRootRaw);
    const homeDir = path.join(tmpRoot, "home");
    const configDir = path.join(tmpRoot, "config");
    const healthyDir = path.join(homeDir, "healthy");
    const staleDir = path.join(homeDir, "stale");
    const logs: string[] = [];

    await fs.mkdir(homeDir, { recursive: true });
    await fs.mkdir(configDir, { recursive: true });
    await fs.mkdir(healthyDir, { recursive: true });
    await fs.mkdir(staleDir, { recursive: true });

    process.env.HOME = homeDir;
    process.env.XDG_CONFIG_HOME = configDir;

    try {
      process.chdir(homeDir);
      const service = ProfileService.create();
      await service.createProfile({
        name: "healthy-profile",
        gitName: "Healthy User",
        email: "healthy@example.com",
      });
      await service.createProfile({
        name: "stale-profile",
        gitName: "Stale User",
        email: "stale@example.com",
      });

      await runCli(
        [rulesCommand.command],
        ["node", "gitface", "rules", "add", healthyDir, "healthy-profile"],
      );
      await runCli(
        [rulesCommand.command],
        ["node", "gitface", "rules", "add", staleDir, "stale-profile"],
      );
      await service.removeProfile("stale-profile");

      const restoreLog = spyConsole(logs);
      await runCli([rulesCommand.command], ["node", "gitface", "rules", "prune", "--json"]);
      restoreLog();

      const output = stripAnsi(logs.join("\n")).trim();
      const parsed = JSON.parse(output) as {
        status: string;
        dryRun: boolean;
        summary: {
          scanned: number;
          prunable: number;
          pruned: number;
          skipped: number;
        };
        results: Array<{
          directory: string;
          profileName: string;
          status: string;
        }>;
        metrics: {
          concurrency: number;
          scanned: number;
          uniqueProfilesChecked: number;
          uniqueDirectoriesChecked: number;
          scanDurationMs: number;
        };
      };

      expect(parsed.status).toBe("pruned");
      expect(parsed.dryRun).toBe(false);
      expect(parsed.summary).toEqual({
        scanned: 2,
        prunable: 1,
        pruned: 1,
        skipped: 0,
      });
      expect(parsed.metrics.scanned).toBe(2);
      expect(parsed.metrics.uniqueProfilesChecked).toBe(2);
      expect(parsed.metrics.uniqueDirectoriesChecked).toBe(0);
      expect(parsed.metrics.scanDurationMs).toBeGreaterThanOrEqual(0);
      expect(parsed.results).toEqual([
        {
          directory: `${staleDir}${path.sep}`,
          profileName: "stale-profile",
          profileExists: false,
          status: "pruned",
        },
      ]);

      logs.length = 0;
      const restoreLogRules = spyConsole(logs);
      await runCli([rulesCommand.command], ["node", "gitface", "rules", "list", "--json"]);
      restoreLogRules();
      const rulesOutput = stripAnsi(logs.join("\n")).trim();
      const listedRules = JSON.parse(rulesOutput) as Array<{
        directory: string;
        profileName: string;
      }>;
      expect(listedRules).toContainEqual({
        directory: `${healthyDir}${path.sep}`,
        profileName: "healthy-profile",
      });
      expect(listedRules).not.toContainEqual({
        directory: `${staleDir}${path.sep}`,
        profileName: "stale-profile",
      });
    } finally {
      process.chdir(originalCwd);
      process.argv = originalArgv;
      process.env.HOME = originalHome;
      if (originalXdg === undefined) {
        delete process.env.XDG_CONFIG_HOME;
      } else {
        process.env.XDG_CONFIG_HOME = originalXdg;
      }
      process.exitCode = originalExitCode;
      await safeRemove(tmpRoot);
    }
  });

  test("prune --strict --json keeps exit code 0 when stale rules are fully pruned", async () => {
    const originalXdg = process.env.XDG_CONFIG_HOME;
    const originalHome = process.env.HOME;
    const originalArgv = process.argv.slice();
    const originalExitCode = process.exitCode;
    const originalCwd = process.cwd();
    const tmpRootRaw = await fs.mkdtemp(
      path.join(os.tmpdir(), "gitface-rules-prune-apply-strict-"),
    );
    const tmpRoot = await fs.realpath(tmpRootRaw);
    const homeDir = path.join(tmpRoot, "home");
    const configDir = path.join(tmpRoot, "config");
    const staleDir = path.join(homeDir, "stale");
    const logs: string[] = [];

    await fs.mkdir(homeDir, { recursive: true });
    await fs.mkdir(configDir, { recursive: true });
    await fs.mkdir(staleDir, { recursive: true });

    process.env.HOME = homeDir;
    process.env.XDG_CONFIG_HOME = configDir;

    try {
      process.chdir(homeDir);
      const service = ProfileService.create();
      await service.createProfile({
        name: "stale-profile",
        gitName: "Stale User",
        email: "stale@example.com",
      });

      await runCli(
        [rulesCommand.command],
        ["node", "gitface", "rules", "add", staleDir, "stale-profile"],
      );
      await service.removeProfile("stale-profile");

      const restoreLog = spyConsole(logs);
      await runCli(
        [rulesCommand.command],
        ["node", "gitface", "rules", "prune", "--strict", "--json"],
      );
      restoreLog();

      const output = stripAnsi(logs.join("\n")).trim();
      const parsed = JSON.parse(output) as {
        status: string;
        dryRun: boolean;
        strict: boolean;
        summary: {
          scanned: number;
          prunable: number;
          pruned: number;
          skipped: number;
        };
      };
      expect(parsed.status).toBe("pruned");
      expect(parsed.dryRun).toBe(false);
      expect(parsed.strict).toBe(true);
      expect(parsed.summary).toEqual({
        scanned: 1,
        prunable: 1,
        pruned: 1,
        skipped: 0,
      });
      expect(process.exitCode).not.toBe(1);
    } finally {
      process.chdir(originalCwd);
      process.argv = originalArgv;
      process.env.HOME = originalHome;
      if (originalXdg === undefined) {
        delete process.env.XDG_CONFIG_HOME;
      } else {
        process.env.XDG_CONFIG_HOME = originalXdg;
      }
      process.exitCode = originalExitCode;
      await safeRemove(tmpRoot);
    }
  });

  test("prune --dry-run --include-missing-directory --json reports missing directory candidates without mutating config", async () => {
    const originalXdg = process.env.XDG_CONFIG_HOME;
    const originalHome = process.env.HOME;
    const originalArgv = process.argv.slice();
    const originalExitCode = process.exitCode;
    const originalCwd = process.cwd();
    const tmpRootRaw = await fs.mkdtemp(
      path.join(os.tmpdir(), "gitface-rules-prune-missing-dir-dry-run-"),
    );
    const tmpRoot = await fs.realpath(tmpRootRaw);
    const homeDir = path.join(tmpRoot, "home");
    const configDir = path.join(tmpRoot, "config");
    const healthyDir = path.join(homeDir, "healthy");
    const missingDir = path.join(homeDir, "missing");
    const logs: string[] = [];

    await fs.mkdir(homeDir, { recursive: true });
    await fs.mkdir(configDir, { recursive: true });
    await fs.mkdir(healthyDir, { recursive: true });
    await fs.mkdir(missingDir, { recursive: true });

    process.env.HOME = homeDir;
    process.env.XDG_CONFIG_HOME = configDir;

    try {
      process.chdir(homeDir);
      const service = ProfileService.create();
      await service.createProfile({
        name: "healthy-profile",
        gitName: "Healthy User",
        email: "healthy@example.com",
      });
      await service.createProfile({
        name: "missing-dir-profile",
        gitName: "Missing Dir User",
        email: "missing-dir@example.com",
      });

      await runCli(
        [rulesCommand.command],
        ["node", "gitface", "rules", "add", healthyDir, "healthy-profile"],
      );
      await runCli(
        [rulesCommand.command],
        ["node", "gitface", "rules", "add", missingDir, "missing-dir-profile"],
      );
      await safeRemove(missingDir);

      const restoreLog = spyConsole(logs);
      await runCli(
        [rulesCommand.command],
        ["node", "gitface", "rules", "prune", "--dry-run", "--include-missing-directory", "--json"],
      );
      restoreLog();

      const output = stripAnsi(logs.join("\n")).trim();
      const parsed = JSON.parse(output) as {
        status: string;
        dryRun: boolean;
        summary: {
          scanned: number;
          prunable: number;
          pruned: number;
          skipped: number;
        };
        results: Array<{
          directory: string;
          profileName: string;
          profileExists: boolean;
          directoryExists: boolean;
          staleReason: string;
          status: string;
        }>;
      };

      expect(parsed.status).toBe("dry-run");
      expect(parsed.dryRun).toBe(true);
      expect(parsed.summary).toEqual({
        scanned: 2,
        prunable: 1,
        pruned: 0,
        skipped: 0,
      });
      expect(parsed.results).toEqual([
        {
          directory: `${missingDir}${path.sep}`,
          profileName: "missing-dir-profile",
          profileExists: true,
          directoryExists: false,
          staleReason: "missing-directory",
          status: "candidate",
        },
      ]);

      logs.length = 0;
      const restoreLogRules = spyConsole(logs);
      await runCli([rulesCommand.command], ["node", "gitface", "rules", "list", "--json"]);
      restoreLogRules();
      const rulesOutput = stripAnsi(logs.join("\n")).trim();
      const listedRules = JSON.parse(rulesOutput) as Array<{
        directory: string;
        profileName: string;
      }>;

      expect(listedRules).toContainEqual({
        directory: `${missingDir}${path.sep}`,
        profileName: "missing-dir-profile",
      });
      expect(listedRules).toContainEqual({
        directory: `${healthyDir}${path.sep}`,
        profileName: "healthy-profile",
      });
    } finally {
      process.chdir(originalCwd);
      process.argv = originalArgv;
      process.env.HOME = originalHome;
      if (originalXdg === undefined) {
        delete process.env.XDG_CONFIG_HOME;
      } else {
        process.env.XDG_CONFIG_HOME = originalXdg;
      }
      process.exitCode = originalExitCode;
      await safeRemove(tmpRoot);
    }
  });

  test("prune --include-missing-directory --json removes missing directory rules and keeps healthy rules", async () => {
    const originalXdg = process.env.XDG_CONFIG_HOME;
    const originalHome = process.env.HOME;
    const originalArgv = process.argv.slice();
    const originalExitCode = process.exitCode;
    const originalCwd = process.cwd();
    const tmpRootRaw = await fs.mkdtemp(
      path.join(os.tmpdir(), "gitface-rules-prune-missing-dir-apply-"),
    );
    const tmpRoot = await fs.realpath(tmpRootRaw);
    const homeDir = path.join(tmpRoot, "home");
    const configDir = path.join(tmpRoot, "config");
    const healthyDir = path.join(homeDir, "healthy");
    const missingDir = path.join(homeDir, "missing");
    const logs: string[] = [];

    await fs.mkdir(homeDir, { recursive: true });
    await fs.mkdir(configDir, { recursive: true });
    await fs.mkdir(healthyDir, { recursive: true });
    await fs.mkdir(missingDir, { recursive: true });

    process.env.HOME = homeDir;
    process.env.XDG_CONFIG_HOME = configDir;

    try {
      process.chdir(homeDir);
      const service = ProfileService.create();
      await service.createProfile({
        name: "healthy-profile",
        gitName: "Healthy User",
        email: "healthy@example.com",
      });
      await service.createProfile({
        name: "missing-dir-profile",
        gitName: "Missing Dir User",
        email: "missing-dir@example.com",
      });

      await runCli(
        [rulesCommand.command],
        ["node", "gitface", "rules", "add", healthyDir, "healthy-profile"],
      );
      await runCli(
        [rulesCommand.command],
        ["node", "gitface", "rules", "add", missingDir, "missing-dir-profile"],
      );
      await safeRemove(missingDir);

      const restoreLog = spyConsole(logs);
      await runCli(
        [rulesCommand.command],
        ["node", "gitface", "rules", "prune", "--include-missing-directory", "--json"],
      );
      restoreLog();

      const output = stripAnsi(logs.join("\n")).trim();
      const parsed = JSON.parse(output) as {
        status: string;
        dryRun: boolean;
        summary: {
          scanned: number;
          prunable: number;
          pruned: number;
          skipped: number;
        };
        results: Array<{
          directory: string;
          profileName: string;
          profileExists: boolean;
          directoryExists: boolean;
          staleReason: string;
          status: string;
        }>;
      };

      expect(parsed.status).toBe("pruned");
      expect(parsed.dryRun).toBe(false);
      expect(parsed.summary).toEqual({
        scanned: 2,
        prunable: 1,
        pruned: 1,
        skipped: 0,
      });
      expect(parsed.results).toEqual([
        {
          directory: `${missingDir}${path.sep}`,
          profileName: "missing-dir-profile",
          profileExists: true,
          directoryExists: false,
          staleReason: "missing-directory",
          status: "pruned",
        },
      ]);

      logs.length = 0;
      const restoreLogRules = spyConsole(logs);
      await runCli([rulesCommand.command], ["node", "gitface", "rules", "list", "--json"]);
      restoreLogRules();
      const rulesOutput = stripAnsi(logs.join("\n")).trim();
      const listedRules = JSON.parse(rulesOutput) as Array<{
        directory: string;
        profileName: string;
      }>;
      expect(listedRules).toContainEqual({
        directory: `${healthyDir}${path.sep}`,
        profileName: "healthy-profile",
      });
      expect(listedRules).not.toContainEqual({
        directory: `${missingDir}${path.sep}`,
        profileName: "missing-dir-profile",
      });
    } finally {
      process.chdir(originalCwd);
      process.argv = originalArgv;
      process.env.HOME = originalHome;
      if (originalXdg === undefined) {
        delete process.env.XDG_CONFIG_HOME;
      } else {
        process.env.XDG_CONFIG_HOME = originalXdg;
      }
      process.exitCode = originalExitCode;
      await safeRemove(tmpRoot);
    }
  });

  test("returns exit code 1 when rules list limit is invalid", async () => {
    const originalXdg = process.env.XDG_CONFIG_HOME;
    const originalHome = process.env.HOME;
    const originalArgv = process.argv.slice();
    const originalExitCode = process.exitCode;
    const originalCwd = process.cwd();
    const tmpRootRaw = await fs.mkdtemp(
      path.join(os.tmpdir(), "gitface-rules-list-invalid-limit-"),
    );
    const tmpRoot = await fs.realpath(tmpRootRaw);
    const homeDir = path.join(tmpRoot, "home");
    const configDir = path.join(tmpRoot, "config");
    const logs: string[] = [];

    await fs.mkdir(homeDir, { recursive: true });
    await fs.mkdir(configDir, { recursive: true });

    process.env.HOME = homeDir;
    process.env.XDG_CONFIG_HOME = configDir;

    try {
      process.chdir(homeDir);
      const restoreLog = spyConsole(logs);
      await runCli([rulesCommand.command], ["node", "gitface", "rules", "list", "--limit", "0"]);
      restoreLog();

      const output = stripAnsi(logs.join("\n"));
      expect(output).toContain("Limit must be a positive integer.");
      expect(process.exitCode).toBe(1);
    } finally {
      process.chdir(originalCwd);
      process.argv = originalArgv;
      process.env.HOME = originalHome;
      if (originalXdg === undefined) {
        delete process.env.XDG_CONFIG_HOME;
      } else {
        process.env.XDG_CONFIG_HOME = originalXdg;
      }
      process.exitCode = originalExitCode;
      await safeRemove(tmpRoot);
    }
  });
});
