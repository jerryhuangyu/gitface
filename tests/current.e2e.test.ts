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
});
