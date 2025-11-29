import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { describe, expect, test, vi } from "vitest";
import { editProfileCommand } from "../src/commands/index";
import { ProfileService } from "../src/core/profile-service";
import {
	runCli,
	safeRemove,
	spyConsole,
	stripAnsi,
} from "./helpers/e2e";

describe("edit command e2e", () => {
	test(
		"updates profile fields and prints success",
		async () => {
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
		},
		10_000,
	);

});
