import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import simpleGit from "simple-git";
import { ProfileService } from "../src/core/profile-service";
import { useProfileCommand } from "../src/commands/index";
import { runCli, safeRemove, spyConsole, stripAnsi } from "./helpers/e2e";

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

			await runCli([useProfileCommand.command], [
				"node",
				"gitface",
				"use",
				"work",
			]);
			const afterWork = await git.listConfig();
			expect(afterWork.all["user.name"]).toBe("Work User");
			expect(afterWork.all["user.email"]).toBe("work@example.com");
			expect(afterWork.all["user.signingkey"]).toBe("WORKKEY");
			expect(stripAnsi(logs.join("\n"))).toMatch(/Used profile 'work'/i);
			logs.length = 0;

			await runCli([useProfileCommand.command], [
				"node",
				"gitface",
				"use",
				"personal",
			]);
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

			await runCli([useProfileCommand.command], [
				"node",
				"gitface",
				"use",
				"missing",
			]);

			const gitConfig = await fs.readFile(
				path.join(repoDir, ".git", "config"),
				"utf8",
			);
			expect(gitConfig.includes("user.name")).toBe(false);
			expect(gitConfig.includes("user.email")).toBe(false);
			expect(process.exitCode).toBe(1);
			expect(stripAnsi(logs.join("\n")).toLowerCase()).toContain("profile");
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
