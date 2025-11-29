import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { Command } from "commander";
import { ProfileService } from "../src/core/profile-service";
import {
	exportProfileCommand,
	importProfileCommand,
} from "../src/commands/index";

describe("export/import e2e", () => {
	test("exports profiles to a file and imports them into a fresh store", async () => {
		const originalXdg = process.env.XDG_CONFIG_HOME;
		const originalArgv = process.argv.slice();
		const originalExitCode = process.exitCode;
		const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gitface-e2e-"));
		const exportConfigDir = path.join(tmpRoot, "export");
		const exportFile = path.join(tmpRoot, "profiles.json");

		try {
			process.env.XDG_CONFIG_HOME = exportConfigDir;
			const exportService = ProfileService.create();
			await exportService.createProfile({
				name: "work",
				gitName: "Work User",
				email: "work@example.com",
				signingKey: "WORKKEY",
			});
			await exportService.createProfile({
				name: "personal",
				gitName: "Personal User",
				email: "me@example.com",
			});

			await runCli(["node", "gitface", "export", exportFile]);

			const exportedContent = JSON.parse(
				await fs.readFile(exportFile, "utf8"),
			) as Array<Record<string, unknown>>;
			expect(exportedContent).toHaveLength(2);

			// Clear existing profiles so re-importing the same data doesn't fail without overwrite.
			await safeRemove(path.join(exportConfigDir, "profiles"));

			process.env.XDG_CONFIG_HOME = exportConfigDir;
			await runCli(["node", "gitface", "import", exportFile]);

			const importService = ProfileService.create();
			const imported = await importService.listProfiles();
			expect(imported.map((p) => p.name).sort()).toEqual([
				"personal",
				"work",
			]);

			const work = imported.find((p) => p.name === "work");
			expect(work?.gitName).toBe("Work User");
			expect(work?.email).toBe("work@example.com");
			expect(work?.signingKey).toBe("WORKKEY");
		} finally {
			process.argv = originalArgv;
			if (originalXdg === undefined) {
				delete process.env.XDG_CONFIG_HOME;
			} else {
				process.env.XDG_CONFIG_HOME = originalXdg;
			}
			process.exitCode = originalExitCode;
			await safeRemove(tmpRoot);
		}
	});
});

async function runCli(args: string[]): Promise<void> {
	const program = new Command();
	program
		.name("gitface")
		.description("A simple CLI tool to change your “face” in Git")
		.version("test");

	program.addCommand(exportProfileCommand.command);
	program.addCommand(importProfileCommand.command);

	await program.parseAsync(args);
}

async function safeRemove(target: string): Promise<void> {
	try {
		await fs.rm(target, { recursive: true, force: true, maxRetries: 3 });
	} catch (error) {
		// Best-effort cleanup; ignore failures that shouldn't affect test assertions.
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
			throw error;
		}
	}
}
