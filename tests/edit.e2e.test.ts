import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { editProfileCommand } from "../src/commands/index";
import { ProfileService } from "../src/core/profile-service";
import {
	runCli,
	safeRemove,
	spyConsole,
	stripAnsi,
} from "./helpers/e2e";

describe("edit command e2e", () => {
	test("updates profile fields and prints success", async () => {
		const originalXdg = process.env.XDG_CONFIG_HOME;
		const originalArgv = process.argv.slice();
		const originalExitCode = process.exitCode;
		const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gitface-cli-"));
		const configDir = path.join(tmpRoot, "config");
		const logs: string[] = [];
		const restoreLog = spyConsole(logs);

		try {
			process.env.XDG_CONFIG_HOME = configDir;

			const service = ProfileService.create();
			await service.createProfile({
				name: "work",
				gitName: "Old Name",
				email: "old@example.com",
				signingKey: "OLDKEY",
			});

			await runCli([editProfileCommand.command], [
				"node",
				"gitface",
				"edit",
				"work",
				"--git-name",
				"New Name",
				"--email",
				"new@example.com",
				"--signing-key",
				"NEWKEY",
			]);

			const updated = await service.getProfile("work");
			expect(updated.gitName).toBe("New Name");
			expect(updated.email).toBe("new@example.com");
			expect(updated.signingKey).toBe("NEWKEY");
			expect(stripAnsi(logs.join("\n"))).toMatch(/Updated profile 'work'/i);
		} finally {
			restoreLog();
			process.argv = originalArgv;
			if (originalXdg === undefined) delete process.env.XDG_CONFIG_HOME;
			else process.env.XDG_CONFIG_HOME = originalXdg;
			process.exitCode = originalExitCode;
			await safeRemove(tmpRoot);
		}
	});

	test("returns machine-readable json with --json", async () => {
		const originalXdg = process.env.XDG_CONFIG_HOME;
		const originalArgv = process.argv.slice();
		const originalExitCode = process.exitCode;
		const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gitface-cli-"));
		const configDir = path.join(tmpRoot, "config");
		const logs: string[] = [];
		const restoreLog = spyConsole(logs);

		try {
			process.env.XDG_CONFIG_HOME = configDir;

			const service = ProfileService.create();
			await service.createProfile({
				name: "work",
				gitName: "Old Name",
				email: "old@example.com",
				signingKey: "OLDKEY",
			});

			await runCli([editProfileCommand.command], [
				"node",
				"gitface",
				"edit",
				"work",
				"--git-name",
				"New Name",
				"--email",
				"new@example.com",
				"--unset-signing-key",
				"--json",
			]);

			const updated = await service.getProfile("work");
			expect(updated.gitName).toBe("New Name");
			expect(updated.email).toBe("new@example.com");
			expect(updated.signingKey).toBeNull();

			const payload = JSON.parse(stripAnsi(logs.join("\n")));
			expect(payload).toEqual({
				status: "updated",
				name: "work",
				gitName: "New Name",
				email: "new@example.com",
				signingKey: null,
			});
			expect(process.exitCode).toBeUndefined();
		} finally {
			restoreLog();
			process.argv = originalArgv;
			if (originalXdg === undefined) delete process.env.XDG_CONFIG_HOME;
			else process.env.XDG_CONFIG_HOME = originalXdg;
			process.exitCode = originalExitCode;
			await safeRemove(tmpRoot);
		}
	});

	test("returns json error with --json when profile is missing", async () => {
		const originalXdg = process.env.XDG_CONFIG_HOME;
		const originalArgv = process.argv.slice();
		const originalExitCode = process.exitCode;
		const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gitface-cli-"));
		const configDir = path.join(tmpRoot, "config");
		const logs: string[] = [];
		const restoreLog = spyConsole(logs);

		try {
			process.env.XDG_CONFIG_HOME = configDir;
			process.exitCode = undefined;

			await runCli([editProfileCommand.command], [
				"node",
				"gitface",
				"edit",
				"missing",
				"--git-name",
				"Name",
				"--json",
			]);

			const payload = JSON.parse(stripAnsi(logs.join("\n")));
			expect(payload).toEqual({
				status: "error",
				name: "missing",
				reason: "Profile 'missing' was not found.",
			});
			expect(process.exitCode).toBe(1);
		} finally {
			restoreLog();
			process.argv = originalArgv;
			if (originalXdg === undefined) delete process.env.XDG_CONFIG_HOME;
			else process.env.XDG_CONFIG_HOME = originalXdg;
			process.exitCode = originalExitCode;
			await safeRemove(tmpRoot);
		}
	});

	test("returns json error when --json is used without non-interactive flags", async () => {
		const originalXdg = process.env.XDG_CONFIG_HOME;
		const originalArgv = process.argv.slice();
		const originalExitCode = process.exitCode;
		const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gitface-cli-"));
		const configDir = path.join(tmpRoot, "config");
		const logs: string[] = [];
		const restoreLog = spyConsole(logs);

		try {
			process.env.XDG_CONFIG_HOME = configDir;
			process.exitCode = undefined;

			await runCli([editProfileCommand.command], [
				"node",
				"gitface",
				"edit",
				"work",
				"--json",
			]);

			const payload = JSON.parse(stripAnsi(logs.join("\n")));
			expect(payload).toEqual({
				status: "error",
				name: "work",
				reason:
					"Non-interactive flags are required when using --json output mode.",
			});
			expect(process.exitCode).toBe(1);
		} finally {
			restoreLog();
			process.argv = originalArgv;
			if (originalXdg === undefined) delete process.env.XDG_CONFIG_HOME;
			else process.env.XDG_CONFIG_HOME = originalXdg;
			process.exitCode = originalExitCode;
			await safeRemove(tmpRoot);
		}
	});
});
