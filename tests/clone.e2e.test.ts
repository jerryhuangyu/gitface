import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test, vi } from "vitest";
import { ProfileService } from "../src/core/profile-service";
import { cloneProfileCommand } from "../src/commands/index";
import { runCli, safeRemove, stripAnsi } from "./helpers/e2e";

describe("clone command e2e", () => {
	test("clones an existing profile via CLI", async () => {
		const originalXdg = process.env.XDG_CONFIG_HOME;
		const originalArgv = process.argv.slice();
		const originalExitCode = process.exitCode;
		const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gitface-cli-"));
		const configDir = path.join(tmpRoot, "config");
		const logs: string[] = [];
		const restoreLog = vi
			.spyOn(console, "log")
			.mockImplementation((...args: unknown[]) => {
				logs.push(args.map(String).join(" "));
			});

		try {
			process.env.XDG_CONFIG_HOME = configDir;

			const service = ProfileService.create();
			await service.createProfile({
				name: "source",
				gitName: "Source User",
				email: "source@example.com",
				signingKey: "SRC",
			});

			await runCli([cloneProfileCommand.command], [
				"node",
				"gitface",
				"clone",
				"source",
				"target",
			]);

			const cloned = await service.getProfile("target");
			expect(cloned.gitName).toBe("Source User");
			expect(cloned.email).toBe("source@example.com");
			expect(cloned.signingKey).toBe("SRC");
			expect(stripAnsi(logs.join("\n"))).toMatch(/Cloned profile 'source'/i);
		} finally {
			restoreLog.mockRestore();
			process.argv = originalArgv;
			if (originalXdg === undefined) delete process.env.XDG_CONFIG_HOME;
			else process.env.XDG_CONFIG_HOME = originalXdg;
			process.exitCode = originalExitCode;
			await safeRemove(tmpRoot);
		}
	});
});
