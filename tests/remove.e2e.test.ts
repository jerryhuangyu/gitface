import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { removeProfileCommand } from "../src/commands/index";
import { ProfileService } from "../src/core/profile-service";
import { runCli, safeRemove, spyConsole, stripAnsi } from "./helpers/e2e";

describe("remove command e2e", () => {
	test("previews removal without deleting profile with --dry-run", async () => {
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
				name: "temp",
				gitName: "Temp User",
				email: "temp@example.com",
			});

			await runCli(
				[removeProfileCommand.command],
				["node", "gitface", "remove", "temp", "--dry-run"],
			);

			const profile = await service.getProfile("temp");
			expect(profile.name).toBe("temp");
			expect(stripAnsi(logs.join("\n"))).toContain("Dry run");
			expect(stripAnsi(logs.join("\n"))).toContain("Would remove profile");
		} finally {
			restoreConsole();
			process.argv = originalArgv;
			if (originalXdg === undefined) delete process.env.XDG_CONFIG_HOME;
			else process.env.XDG_CONFIG_HOME = originalXdg;
			process.exitCode = originalExitCode;
			await safeRemove(tmpRoot);
		}
	});

	test("emits JSON preview without deleting profile with --dry-run --json", async () => {
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
				name: "temp",
				gitName: "Temp User",
				email: "temp@example.com",
			});

			await runCli(
				[removeProfileCommand.command],
				["node", "gitface", "remove", "temp", "--dry-run", "--json"],
			);

			const profile = await service.getProfile("temp");
			expect(profile.name).toBe("temp");

			const parsed = JSON.parse(stripAnsi(logs.join("\n"))) as Record<
				string,
				unknown
			>;
			expect(parsed).toEqual({
				status: "dry-run",
				name: "temp",
				gitName: "Temp User",
				email: "temp@example.com",
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

	test("removes an existing profile via CLI", async () => {
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
				name: "temp",
				gitName: "Temp User",
				email: "temp@example.com",
			});

			await runCli(
				[removeProfileCommand.command],
				["node", "gitface", "remove", "temp"],
			);

			await expect(service.getProfile("temp")).rejects.toThrow();
			expect(stripAnsi(logs.join("\n"))).toMatch(/Removed profile 'temp'/i);
		} finally {
			restoreConsole();
			process.argv = originalArgv;
			if (originalXdg === undefined) delete process.env.XDG_CONFIG_HOME;
			else process.env.XDG_CONFIG_HOME = originalXdg;
			process.exitCode = originalExitCode;
			await safeRemove(tmpRoot);
		}
	});

	test("emits JSON output when removing an existing profile with --json", async () => {
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
				name: "temp",
				gitName: "Temp User",
				email: "temp@example.com",
			});

			await runCli(
				[removeProfileCommand.command],
				["node", "gitface", "remove", "temp", "--json"],
			);

			await expect(service.getProfile("temp")).rejects.toThrow();

			const parsed = JSON.parse(stripAnsi(logs.join("\n"))) as Record<
				string,
				unknown
			>;
			expect(parsed).toEqual({
				status: "removed",
				name: "temp",
				gitName: "Temp User",
				email: "temp@example.com",
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

	test("emits JSON error and sets exit code when profile is missing with --json", async () => {
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
				name: "work",
				gitName: "Work User",
				email: "work@example.com",
			});
			process.exitCode = undefined;

			await runCli(
				[removeProfileCommand.command],
				["node", "gitface", "remove", "missing", "--json"],
			);

			const parsed = JSON.parse(stripAnsi(logs.join("\n"))) as Record<
				string,
				unknown
			>;
			expect(parsed.status).toBe("error");
			expect(parsed.name).toBe("missing");
			expect(parsed.reason).toBeTypeOf("string");
			expect(String(parsed.reason)).toContain("'missing' does not exist.");
			expect(String(parsed.reason)).toContain("Did you mean");
			expect(String(parsed.reason)).toContain("'work'");
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

	test("emits Result Envelope when removing an existing profile with --json-envelope", async () => {
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
				name: "temp",
				gitName: "Temp User",
				email: "temp@example.com",
			});

			await runCli(
				[removeProfileCommand.command],
				["node", "gitface", "remove", "temp", "--json-envelope"],
			);

			await expect(service.getProfile("temp")).rejects.toThrow();
			const parsed = JSON.parse(stripAnsi(logs.join("\n"))) as Record<
				string,
				unknown
			>;
			expect(parsed.status).toBe("success");
			expect(parsed.code).toBe("REMOVE_PROFILE_OK");
			expect(parsed.message).toBe("Profile removed successfully.");
			expect(parsed.data).toEqual({
				result: "removed",
				name: "temp",
				force: false,
				profile: {
					name: "temp",
					gitName: "Temp User",
					email: "temp@example.com",
					signingKey: null,
				},
				reason: null,
			});
			expect(parsed.errors).toEqual([]);
			expect(parsed.meta).toEqual({
				schemaVersion: "1.0.0",
				durationMs: expect.any(Number),
				traceId: expect.any(String),
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

	test("emits Result Envelope dry-run payload with --dry-run --json-envelope", async () => {
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
				name: "temp",
				gitName: "Temp User",
				email: "temp@example.com",
			});

			await runCli(
				[removeProfileCommand.command],
				["node", "gitface", "remove", "temp", "--dry-run", "--json-envelope"],
			);

			const profile = await service.getProfile("temp");
			expect(profile.name).toBe("temp");
			const parsed = JSON.parse(stripAnsi(logs.join("\n"))) as Record<
				string,
				unknown
			>;
			expect(parsed.status).toBe("success");
			expect(parsed.code).toBe("REMOVE_PROFILE_DRY_RUN");
			expect(parsed.data).toEqual({
				result: "dry-run",
				name: "temp",
				force: false,
				profile: {
					name: "temp",
					gitName: "Temp User",
					email: "temp@example.com",
					signingKey: null,
				},
				reason: null,
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

	test("emits Result Envelope skipped payload with --force --json-envelope", async () => {
		const originalXdg = process.env.XDG_CONFIG_HOME;
		const originalArgv = process.argv.slice();
		const originalExitCode = process.exitCode;
		const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gitface-cli-"));
		const configDir = path.join(tmpRoot, "config");
		const logs: string[] = [];
		const restoreConsole = spyConsole(logs);

		try {
			process.env.XDG_CONFIG_HOME = configDir;

			await runCli(
				[removeProfileCommand.command],
				["node", "gitface", "remove", "missing", "--force", "--json-envelope"],
			);

			const parsed = JSON.parse(stripAnsi(logs.join("\n"))) as Record<
				string,
				unknown
			>;
			expect(parsed.status).toBe("success");
			expect(parsed.code).toBe("REMOVE_PROFILE_SKIPPED");
			expect(parsed.data).toEqual({
				result: "skipped",
				name: "missing",
				force: true,
				profile: null,
				reason: "Profile not found.",
			});
			expect(process.exitCode).toBeUndefined();
		} finally {
			restoreConsole();
			process.argv = originalArgv;
			if (originalXdg === undefined) delete process.env.XDG_CONFIG_HOME;
			else process.env.XDG_CONFIG_HOME = originalXdg;
			process.exitCode = originalExitCode;
			await safeRemove(tmpRoot);
		}
	});

	test("returns Result Envelope error and exit code 1 when missing profile with --json-envelope", async () => {
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
				name: "work",
				gitName: "Work User",
				email: "work@example.com",
			});
			process.exitCode = undefined;

			await runCli(
				[removeProfileCommand.command],
				["node", "gitface", "remove", "missing", "--json-envelope"],
			);

			const parsed = JSON.parse(stripAnsi(logs.join("\n"))) as Record<
				string,
				unknown
			>;
			expect(parsed.status).toBe("error");
			expect(parsed.code).toBe("REMOVE_PROFILE_NOT_FOUND");
			expect(parsed.message).toContain("'missing' does not exist.");
			expect(parsed.message).toContain("Did you mean");
			expect(parsed.errors).toEqual([
				{
					code: "REMOVE_PROFILE_NOT_FOUND",
					message: expect.stringContaining("'missing' does not exist."),
				},
			]);
			expect(parsed.data).toBeNull();
			expect(parsed.meta).toEqual({
				schemaVersion: "1.0.0",
				durationMs: expect.any(Number),
				traceId: expect.any(String),
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
});
