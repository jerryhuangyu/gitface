import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { removeProfileCommand } from "../src/commands/index";
import { ProfileService } from "../src/core/profile-service";
import { runCli, safeRemove, spyConsole, stripAnsi } from "./helpers/e2e";

describe("remove command e2e", () => {
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

			await runCli([removeProfileCommand.command], [
				"node",
				"gitface",
				"remove",
				"temp",
			]);

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

			await runCli([removeProfileCommand.command], [
				"node",
				"gitface",
				"remove",
				"temp",
				"--json",
			]);

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

			await runCli([removeProfileCommand.command], [
				"node",
				"gitface",
				"remove",
				"missing",
				"--json",
			]);

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
});
