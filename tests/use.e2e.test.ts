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

			await runCli([useProfileCommand.command], [
				"node",
				"gitface",
				"use",
				"work",
				"--json",
			]);

			const parsed = JSON.parse(stripAnsi(logs.join("\n"))) as Record<
				string,
				unknown
			>;
			expect(parsed).toEqual({
				name: "work",
				gitName: "Work User",
				email: "work@example.com",
				signingKey: null,
				scope: "local",
			});

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

			await runCli([useProfileCommand.command], [
				"node",
				"gitface",
				"use",
				"work",
				"--dry-run",
				"--json",
			]);

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

			await runCli([useProfileCommand.command], [
				"node",
				"gitface",
				"use",
				"work",
				"--json",
			]);

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

			await runCli([useProfileCommand.command], [
				"node",
				"gitface",
				"use",
				"work",
				"--dry-run",
				"--json",
			]);

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
