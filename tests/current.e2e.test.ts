import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test, vi } from "vitest";
import simpleGit from "simple-git";
import { currentIdentityCommand } from "../src/commands/index";
import { runCli, safeRemove, spyConsole, stripAnsi } from "./helpers/e2e";

describe("current command e2e", () => {
	test("prints current identity from repo config", async () => {
		const originalXdg = process.env.XDG_CONFIG_HOME;
		const originalArgv = process.argv.slice();
		const originalExitCode = process.exitCode;
		const originalCwd = process.cwd();
		const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gitface-cli-"));
		const repoDir = path.join(tmpRoot, "repo");
		const configDir = path.join(tmpRoot, "config");
		await fs.mkdir(repoDir);
		const git = simpleGit({ baseDir: repoDir });
		await git.init();
		await git.addConfig("user.name", "CLI User");
		await git.addConfig("user.email", "cli@example.com");
		await git.addConfig("user.signingkey", "SIGNKEY");

		const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

		try {
			process.chdir(repoDir);
			process.env.XDG_CONFIG_HOME = configDir;

			await runCli([currentIdentityCommand.command], [
				"node",
				"gitface",
				"current",
			]);

			const output = logSpy.mock.calls.flat().join("\n");
			expect(output).toContain("CLI User");
			expect(output).toContain("cli@example.com");
			expect(output).toContain("SIGNKEY");
		} finally {
			logSpy.mockRestore();
			process.chdir(originalCwd);
			process.argv = originalArgv;
			if (originalXdg === undefined) delete process.env.XDG_CONFIG_HOME;
			else process.env.XDG_CONFIG_HOME = originalXdg;
			process.exitCode = originalExitCode;
			await safeRemove(tmpRoot);
		}
	});

	test("outputs current identity as json with --json", async () => {
		const originalXdg = process.env.XDG_CONFIG_HOME;
		const originalArgv = process.argv.slice();
		const originalExitCode = process.exitCode;
		const originalCwd = process.cwd();
		const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gitface-cli-"));
		const repoDir = path.join(tmpRoot, "repo");
		const configDir = path.join(tmpRoot, "config");
		const logs: string[] = [];

		await fs.mkdir(repoDir);
		const git = simpleGit({ baseDir: repoDir });
		await git.init();
		await git.addConfig("user.name", "Json User");
		await git.addConfig("user.email", "json@example.com");
		await git.addConfig("user.signingkey", "JSONKEY");

		try {
			process.chdir(repoDir);
			process.env.XDG_CONFIG_HOME = configDir;

			const restoreLog = spyConsole(logs);
			await runCli([currentIdentityCommand.command], [
				"node",
				"gitface",
				"current",
				"--json",
			]);
			restoreLog();

			const output = stripAnsi(logs.join("\n")).trim();
			const parsed = JSON.parse(output) as {
				gitName: string;
				email: string;
				signingKey: string | null;
			};

			expect(parsed).toStrictEqual({
				gitName: "Json User",
				email: "json@example.com",
				signingKey: "JSONKEY",
			});
		} finally {
			process.chdir(originalCwd);
			process.argv = originalArgv;
			if (originalXdg === undefined) delete process.env.XDG_CONFIG_HOME;
			else process.env.XDG_CONFIG_HOME = originalXdg;
			process.exitCode = originalExitCode;
			await safeRemove(tmpRoot);
		}
	});

	test("outputs scoped global identity as json with --scope", async () => {
		const originalXdg = process.env.XDG_CONFIG_HOME;
		const originalGlobal = process.env.GIT_CONFIG_GLOBAL;
		const originalArgv = process.argv.slice();
		const originalExitCode = process.exitCode;
		const originalCwd = process.cwd();
		const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gitface-cli-"));
		const repoDir = path.join(tmpRoot, "repo");
		const configDir = path.join(tmpRoot, "config");
		const globalConfig = path.join(tmpRoot, "gitconfig-global");
		const logs: string[] = [];

		await fs.mkdir(repoDir);
		const git = simpleGit({ baseDir: repoDir });
		await git.init();
		await git.addConfig("user.name", "Local User");
		await git.addConfig("user.email", "local@example.com");

		try {
			process.chdir(repoDir);
			process.env.XDG_CONFIG_HOME = configDir;
			process.env.GIT_CONFIG_GLOBAL = globalConfig;

			await git.raw(["config", "--global", "user.name", "Global User"]);
			await git.raw(["config", "--global", "user.email", "global@example.com"]);
			await git.raw(["config", "--global", "user.signingkey", "GLOBALKEY"]);

			const restoreLog = spyConsole(logs);
			await runCli([currentIdentityCommand.command], [
				"node",
				"gitface",
				"current",
				"--scope",
				"global",
				"--json",
			]);
			restoreLog();

			const output = stripAnsi(logs.join("\n")).trim();
			const parsed = JSON.parse(output) as {
				gitName: string;
				email: string;
				signingKey: string | null;
				scope: string;
			};

			expect(parsed).toStrictEqual({
				gitName: "Global User",
				email: "global@example.com",
				signingKey: "GLOBALKEY",
				scope: "global",
			});
		} finally {
			process.chdir(originalCwd);
			process.argv = originalArgv;
			if (originalXdg === undefined) delete process.env.XDG_CONFIG_HOME;
			else process.env.XDG_CONFIG_HOME = originalXdg;
			if (originalGlobal === undefined) delete process.env.GIT_CONFIG_GLOBAL;
			else process.env.GIT_CONFIG_GLOBAL = originalGlobal;
			process.exitCode = originalExitCode;
			await safeRemove(tmpRoot);
		}
	});

	test("returns json error for invalid scope with --json", async () => {
		const originalXdg = process.env.XDG_CONFIG_HOME;
		const originalArgv = process.argv.slice();
		const originalExitCode = process.exitCode;
		const originalCwd = process.cwd();
		const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gitface-cli-"));
		const repoDir = path.join(tmpRoot, "repo");
		const configDir = path.join(tmpRoot, "config");
		const logs: string[] = [];

		await fs.mkdir(repoDir);
		const git = simpleGit({ baseDir: repoDir });
		await git.init();

		try {
			process.chdir(repoDir);
			process.env.XDG_CONFIG_HOME = configDir;
			process.exitCode = undefined;

			const restoreLog = spyConsole(logs);
			await runCli([currentIdentityCommand.command], [
				"node",
				"gitface",
				"current",
				"--scope",
				"workspace",
				"--json",
			]);
			restoreLog();

			const output = stripAnsi(logs.join("\n")).trim();
			const parsed = JSON.parse(output) as {
				status: string;
				reason: string;
			};

			expect(parsed).toStrictEqual({
				status: "error",
				reason: "Scope must be one of: local, global, system.",
			});
			expect(process.exitCode).toBe(1);
		} finally {
			process.chdir(originalCwd);
			process.argv = originalArgv;
			if (originalXdg === undefined) delete process.env.XDG_CONFIG_HOME;
			else process.env.XDG_CONFIG_HOME = originalXdg;
			process.exitCode = originalExitCode;
			await safeRemove(tmpRoot);
		}
	});
});
