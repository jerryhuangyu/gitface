import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test, vi } from "vitest";
import { renameProfileCommand } from "../src/commands/index";
import { ProfileService } from "../src/core/profile-service";
import { runCli, safeRemove, stripAnsi } from "./helpers/e2e";

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
});
