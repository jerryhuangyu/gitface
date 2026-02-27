import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test, vi } from "vitest";
import simpleGit from "simple-git";
import { doctorCommand } from "../src/commands/index";
import { runCli, safeRemove } from "./helpers/e2e";

describe("doctor command e2e", () => {
	test("passes when git and profile store are available", async () => {
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
		await git.addConfig("user.name", "Doctor User");
		await git.addConfig("user.email", "doctor@example.com");

		const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

		try {
			process.chdir(repoDir);
			process.env.XDG_CONFIG_HOME = configDir;
			process.exitCode = undefined;

			await runCli([doctorCommand.command], ["node", "gitface", "doctor"]);

			const output = logSpy.mock.calls.flat().join("\n");
			expect(output).toContain("GitFace Doctor");
			expect(output.toLowerCase()).toContain("all checks passed");
			expect(process.exitCode).toBeUndefined();
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

	test("outputs machine-readable JSON with --json", async () => {
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
		await git.addConfig("user.name", "Doctor User");
		await git.addConfig("user.email", "doctor@example.com");

		const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

		try {
			process.chdir(repoDir);
			process.env.XDG_CONFIG_HOME = configDir;
			process.exitCode = undefined;

			await runCli(
				[doctorCommand.command],
				["node", "gitface", "doctor", "--json"],
			);

			const output = logSpy.mock.calls.flat().join("\n");
			const parsed = JSON.parse(output) as {
				checks: { status: string; message: string }[];
				hasFailures: boolean;
			};

			expect(parsed.checks).toHaveLength(3);
			expect(parsed.hasFailures).toBe(false);
			expect(parsed.checks.every((check) => check.message.length > 0)).toBe(true);
			expect(
				parsed.checks.every((check) =>
					["pass", "warn", "fail"].includes(check.status),
				),
			).toBe(true);
			expect(process.exitCode).toBeUndefined();
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
});
