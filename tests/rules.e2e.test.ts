import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import simpleGit from "simple-git";
import { ProfileService } from "../src/core/profile-service";
import { rulesCommand } from "../src/commands/index";
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

			await runCli([rulesCommand.command], [
				"node",
				"gitface",
				"rules",
				"add",
				projectDir,
				"work-profile",
			]);

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

			await runCli([rulesCommand.command], [
				"node",
				"gitface",
				"rules",
				"remove",
				projectDir,
			]);

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

			await runCli([rulesCommand.command], [
				"node",
				"gitface",
				"rules",
				"add",
				projectDir,
				"ops-profile",
			]);

			const restoreLog = spyConsole(logs);
			await runCli([rulesCommand.command], [
				"node",
				"gitface",
				"rules",
				"list",
				"--json",
			]);
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
			await runCli([rulesCommand.command], [
				"node",
				"gitface",
				"rules",
				"add",
				projectDir,
				"eng-profile",
				"--json",
			]);
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
			await runCli([rulesCommand.command], [
				"node",
				"gitface",
				"rules",
				"remove",
				projectDir,
				"--json",
			]);
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

			const restoreLog = spyConsole(logs);
			await runCli([rulesCommand.command], [
				"node",
				"gitface",
				"rules",
				"add",
				projectDir,
				"missing-profile",
				"--json",
			]);
			restoreLog();

			const output = stripAnsi(logs.join("\n")).trim();
			const parsed = JSON.parse(output) as {
				status: string;
				directory: string;
				profileName: string;
				reason: string;
			};

			expect(parsed.status).toBe("error");
			expect(parsed.profileName).toBe("missing-profile");
			expect(parsed.directory).toBe(`${projectDir}${path.sep}`);
			expect(parsed.reason).toContain("not found");
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
