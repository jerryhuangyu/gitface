import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test, vi } from "vitest";
import { renameProfileCommand } from "../src/commands/index";
import { ProfileService } from "../src/core/profile-service";
import { runCli, safeRemove, spyConsole, stripAnsi } from "./helpers/e2e";
import { rulesCommand } from "../src/commands/index";

describe("rename command e2e", () => {
	test("renames an existing profile via CLI", async () => {
		const originalXdg = process.env.XDG_CONFIG_HOME;
		const originalArgv = process.argv.slice();
		const originalExitCode = process.exitCode;
		const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gitface-cli-"));
		const configDir = path.join(tmpRoot, "config");
		const logs: string[] = [];
		const logSpy = vi
			.spyOn(console, "log")
			.mockImplementation((...args: unknown[]) => {
				logs.push(args.map(String).join(" "));
			});

		try {
			process.env.XDG_CONFIG_HOME = configDir;
			const service = ProfileService.create();
			await service.createProfile({
				name: "old",
				gitName: "Old User",
				email: "old@example.com",
			});

			await runCli([renameProfileCommand.command], [
				"node",
				"gitface",
				"rename",
				"old",
				"new",
			]);

			await expect(service.getProfile("old")).rejects.toThrow();
			const renamed = await service.getProfile("new");
			expect(renamed.gitName).toBe("Old User");
			expect(renamed.email).toBe("old@example.com");
			expect(stripAnsi(logs.join("\n"))).toMatch(/Renamed profile 'old'/i);
		} finally {
			logSpy.mockRestore();
			process.argv = originalArgv;
			if (originalXdg === undefined) delete process.env.XDG_CONFIG_HOME;
			else process.env.XDG_CONFIG_HOME = originalXdg;
			process.exitCode = originalExitCode;
			await safeRemove(tmpRoot);
		}
	});

	test("emits JSON output when renaming an existing profile with --json", async () => {
		const originalXdg = process.env.XDG_CONFIG_HOME;
		const originalArgv = process.argv.slice();
		const originalExitCode = process.exitCode;
		const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gitface-cli-"));
		const configDir = path.join(tmpRoot, "config");
		const logs: string[] = [];
		const restoreConsole = spyConsole(logs);

		try {
			process.env.XDG_CONFIG_HOME = configDir;
			const service = ProfileService.create();
			await service.createProfile({
				name: "old",
				gitName: "Old User",
				email: "old@example.com",
			});

			await runCli([renameProfileCommand.command], [
				"node",
				"gitface",
				"rename",
				"old",
				"new",
				"--json",
			]);

			await expect(service.getProfile("old")).rejects.toThrow();
			const renamed = await service.getProfile("new");
			expect(renamed.gitName).toBe("Old User");
			expect(renamed.email).toBe("old@example.com");

			const parsed = JSON.parse(stripAnsi(logs.join("\n"))) as Record<
				string,
				unknown
			>;
			expect(parsed).toEqual({
				status: "renamed",
				oldName: "old",
				name: "new",
				rulesUpdated: expect.any(Number),
				gitName: "Old User",
				email: "old@example.com",
				signingKey: null,
			});
		} finally {
			restoreConsole();
			process.argv = originalArgv;
			if (originalXdg === undefined) delete process.env.XDG_CONFIG_HOME;
			else process.env.XDG_CONFIG_HOME = originalXdg;
			process.exitCode = originalExitCode;
			await safeRemove(tmpRoot);
		}
	});

	test("emits JSON error and sets exit code when source profile is missing", async () => {
		const originalXdg = process.env.XDG_CONFIG_HOME;
		const originalArgv = process.argv.slice();
		const originalExitCode = process.exitCode;
		const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gitface-cli-"));
		const configDir = path.join(tmpRoot, "config");
		const logs: string[] = [];
		const restoreConsole = spyConsole(logs);

		try {
			process.env.XDG_CONFIG_HOME = configDir;
			const service = ProfileService.create();
			await service.createProfile({
				name: "old",
				gitName: "Old User",
				email: "old@example.com",
			});
			process.exitCode = undefined;

			await runCli([renameProfileCommand.command], [
				"node",
				"gitface",
				"rename",
				"missing",
				"new",
				"--json",
			]);

			const parsed = JSON.parse(stripAnsi(logs.join("\n"))) as Record<
				string,
				unknown
			>;
			expect(parsed.status).toBe("error");
			expect(parsed.oldName).toBe("missing");
			expect(parsed.newName).toBe("new");
			expect(parsed.reason).toBeTypeOf("string");
			expect(String(parsed.reason)).toContain("'missing' does not exist.");
			expect(String(parsed.reason)).toContain("Did you mean");
			expect(String(parsed.reason)).toContain("'old'");
			expect(process.exitCode).toBe(1);
		} finally {
			restoreConsole();
			process.argv = originalArgv;
			if (originalXdg === undefined) delete process.env.XDG_CONFIG_HOME;
			else process.env.XDG_CONFIG_HOME = originalXdg;
			process.exitCode = originalExitCode;
			await safeRemove(tmpRoot);
		}
	});

	test("emits JSON error and sets exit code when target profile already exists", async () => {
		const originalXdg = process.env.XDG_CONFIG_HOME;
		const originalArgv = process.argv.slice();
		const originalExitCode = process.exitCode;
		const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gitface-cli-"));
		const configDir = path.join(tmpRoot, "config");
		const logs: string[] = [];
		const restoreConsole = spyConsole(logs);

		try {
			process.env.XDG_CONFIG_HOME = configDir;
			const service = ProfileService.create();
			await service.createProfile({
				name: "old",
				gitName: "Old User",
				email: "old@example.com",
			});
			await service.createProfile({
				name: "new",
				gitName: "New User",
				email: "new@example.com",
			});
			process.exitCode = undefined;

			await runCli([renameProfileCommand.command], [
				"node",
				"gitface",
				"rename",
				"old",
				"new",
				"--json",
			]);

			const parsed = JSON.parse(stripAnsi(logs.join("\n"))) as Record<
				string,
				unknown
			>;
			expect(parsed).toEqual({
				status: "error",
				oldName: "old",
				newName: "new",
				reason: "Profile 'new' already exists.",
			});
			expect(process.exitCode).toBe(1);
		} finally {
			restoreConsole();
			process.argv = originalArgv;
			if (originalXdg === undefined) delete process.env.XDG_CONFIG_HOME;
			else process.env.XDG_CONFIG_HOME = originalXdg;
			process.exitCode = originalExitCode;
			await safeRemove(tmpRoot);
		}
	});

	test("supports --dry-run --json without mutating profile files", async () => {
		const originalXdg = process.env.XDG_CONFIG_HOME;
		const originalArgv = process.argv.slice();
		const originalExitCode = process.exitCode;
		const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gitface-cli-"));
		const configDir = path.join(tmpRoot, "config");
		const logs: string[] = [];
		const restoreConsole = spyConsole(logs);

		try {
			process.env.XDG_CONFIG_HOME = configDir;
			const service = ProfileService.create();
			await service.createProfile({
				name: "old",
				gitName: "Old User",
				email: "old@example.com",
			});

			await runCli([renameProfileCommand.command], [
				"node",
				"gitface",
				"rename",
				"old",
				"new",
				"--dry-run",
				"--json",
			]);

			const parsed = JSON.parse(stripAnsi(logs.join("\n"))) as Record<
				string,
				unknown
			>;
			expect(parsed).toEqual({
				status: "dry-run",
				oldName: "old",
				newName: "new",
				overwrite: false,
				rulesToUpdate: expect.any(Number),
				gitName: "Old User",
				email: "old@example.com",
				signingKey: null,
			});

			const oldProfile = await service.getProfile("old");
			expect(oldProfile.gitName).toBe("Old User");
			await expect(service.getProfile("new")).rejects.toThrow();
		} finally {
			restoreConsole();
			process.argv = originalArgv;
			if (originalXdg === undefined) delete process.env.XDG_CONFIG_HOME;
			else process.env.XDG_CONFIG_HOME = originalXdg;
			process.exitCode = originalExitCode;
			await safeRemove(tmpRoot);
		}
	});

	test("reports overwrite=true for --dry-run --force when target exists", async () => {
		const originalXdg = process.env.XDG_CONFIG_HOME;
		const originalArgv = process.argv.slice();
		const originalExitCode = process.exitCode;
		const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gitface-cli-"));
		const configDir = path.join(tmpRoot, "config");
		const logs: string[] = [];
		const restoreConsole = spyConsole(logs);

		try {
			process.env.XDG_CONFIG_HOME = configDir;
			const service = ProfileService.create();
			await service.createProfile({
				name: "old",
				gitName: "Old User",
				email: "old@example.com",
			});
			await service.createProfile({
				name: "new",
				gitName: "New User",
				email: "new@example.com",
			});

			await runCli([renameProfileCommand.command], [
				"node",
				"gitface",
				"rename",
				"old",
				"new",
				"--dry-run",
				"--force",
				"--json",
			]);

			const parsed = JSON.parse(stripAnsi(logs.join("\n"))) as Record<
				string,
				unknown
			>;
			expect(parsed).toEqual({
				status: "dry-run",
				oldName: "old",
				newName: "new",
				overwrite: true,
				rulesToUpdate: expect.any(Number),
				gitName: "Old User",
				email: "old@example.com",
				signingKey: null,
			});

			const oldProfile = await service.getProfile("old");
			expect(oldProfile.gitName).toBe("Old User");
			const newProfile = await service.getProfile("new");
			expect(newProfile.gitName).toBe("New User");
		} finally {
			restoreConsole();
			process.argv = originalArgv;
			if (originalXdg === undefined) delete process.env.XDG_CONFIG_HOME;
			else process.env.XDG_CONFIG_HOME = originalXdg;
			process.exitCode = originalExitCode;
			await safeRemove(tmpRoot);
		}
	});

	test("migrates rules to renamed profile and reports rulesUpdated in json output", async () => {
		const originalXdg = process.env.XDG_CONFIG_HOME;
		const originalHome = process.env.HOME;
		const originalArgv = process.argv.slice();
		const originalExitCode = process.exitCode;
		const originalCwd = process.cwd();
		const tmpRootRaw = await fs.mkdtemp(path.join(os.tmpdir(), "gitface-rename-rules-"));
		const tmpRoot = await fs.realpath(tmpRootRaw);
		const homeDir = path.join(tmpRoot, "home");
		const configDir = path.join(tmpRoot, "config");
		const projectDir = path.join(homeDir, "project");
		const logs: string[] = [];
		const restoreConsole = spyConsole(logs);

		await fs.mkdir(homeDir, { recursive: true });
		await fs.mkdir(configDir, { recursive: true });
		await fs.mkdir(projectDir, { recursive: true });
		process.env.HOME = homeDir;
		process.env.XDG_CONFIG_HOME = configDir;

		try {
			process.chdir(homeDir);
			const service = ProfileService.create();
			await service.createProfile({
				name: "old",
				gitName: "Old User",
				email: "old@example.com",
			});

			await runCli([rulesCommand.command], [
				"node",
				"gitface",
				"rules",
				"add",
				projectDir,
				"old",
			]);

			await runCli([renameProfileCommand.command], [
				"node",
				"gitface",
				"rename",
				"old",
				"new",
				"--json",
			]);

			const renameJsonLine = stripAnsi(logs.join("\n"))
				.split("\n")
				.map((line) => line.trim())
				.filter((line) => line.startsWith("{"))
				.pop();
			expect(renameJsonLine).toBeDefined();
			const parsed = JSON.parse(renameJsonLine ?? "{}") as {
				status: string;
				rulesUpdated: number;
			};
			expect(parsed.status).toBe("renamed");
			expect(parsed.rulesUpdated).toBe(1);

			logs.length = 0;
			await runCli([rulesCommand.command], [
				"node",
				"gitface",
				"rules",
				"resolve",
				projectDir,
				"--json",
			]);
			const resolved = JSON.parse(stripAnsi(logs.join("\n"))) as {
				status: string;
				matchedRule?: { profileName?: string };
				profileExists?: boolean;
			};
			expect(resolved.status).toBe("matched");
			expect(resolved.matchedRule?.profileName).toBe("new");
			expect(resolved.profileExists).toBe(true);
		} finally {
			restoreConsole();
			process.chdir(originalCwd);
			process.argv = originalArgv;
			process.env.HOME = originalHome;
			if (originalXdg === undefined) delete process.env.XDG_CONFIG_HOME;
			else process.env.XDG_CONFIG_HOME = originalXdg;
			process.exitCode = originalExitCode;
			await safeRemove(tmpRoot);
		}
	});
});
