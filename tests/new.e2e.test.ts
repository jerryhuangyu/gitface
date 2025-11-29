import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test, vi } from "vitest";
import { newProfileCommand } from "../src/commands/index";
import { ProfileService } from "../src/core/profile-service";
import { runCli, safeRemove, stripAnsi } from "./helpers/e2e";

describe("new command e2e", () => {
	test("creates a profile with provided fields", async () => {
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

			await runCli([newProfileCommand.command], [
				"node",
				"gitface",
				"new",
				"work",
				"--git-name",
				"Work User",
				"--email",
				"work@example.com",
				"--signing-key",
				"WORKKEY",
			]);

			const service = ProfileService.create();
			const profile = await service.getProfile("work");
			expect(profile.gitName).toBe("Work User");
			expect(profile.email).toBe("work@example.com");
			expect(profile.signingKey).toBe("WORKKEY");
			expect(stripAnsi(logs.join("\n"))).toMatch(/Saved profile 'work'/i);
		} finally {
			logSpy.mockRestore();
			process.argv = originalArgv;
			if (originalXdg === undefined) delete process.env.XDG_CONFIG_HOME;
			else process.env.XDG_CONFIG_HOME = originalXdg;
			process.exitCode = originalExitCode;
			await safeRemove(tmpRoot);
		}
	});
});
