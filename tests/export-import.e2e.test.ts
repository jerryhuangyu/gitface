import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import {
	exportProfileCommand,
	importProfileCommand,
} from "../src/commands/index";
import { ProfileService } from "../src/core/profile-service";
import { runCli, safeRemove, spyConsole, stripAnsi } from "./helpers/e2e";

describe("export/import e2e", () => {
	test("exports profiles to a file and imports them into a fresh store", async () => {
		const originalXdg = process.env.XDG_CONFIG_HOME;
		const originalExitCode = process.exitCode;
		const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gitface-e2e-"));
		const exportConfigDir = path.join(tmpRoot, "export");
		const importConfigDir = path.join(tmpRoot, "import");
		const exportFile = path.join(tmpRoot, "profiles.json");
		const logs: string[] = [];
		const restoreLog = spyConsole(logs);

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

			await runCli(
				[exportProfileCommand.command, importProfileCommand.command],
				["node", "gitface", "export", exportFile],
			);

			const exportedContent = JSON.parse(
				await fs.readFile(exportFile, "utf8"),
			) as Array<Record<string, unknown>>;
			expect(exportedContent).toHaveLength(2);
			expect(stripAnsi(logs.join("\n"))).toMatch(/Exported 2 profiles/i);
			logs.length = 0;

			process.env.XDG_CONFIG_HOME = importConfigDir;
			await runCli(
				[exportProfileCommand.command, importProfileCommand.command],
				["node", "gitface", "import", exportFile],
			);

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
			expect(stripAnsi(logs.join("\n"))).toMatch(/Imported 2 profiles/i);
		} finally {
			restoreLog();
			if (originalXdg === undefined) {
				delete process.env.XDG_CONFIG_HOME;
			} else {
				process.env.XDG_CONFIG_HOME = originalXdg;
			}
			process.exitCode = originalExitCode;
			await safeRemove(tmpRoot);
		}
	});

	test("supports dry-run import without mutating profile store", async () => {
		const originalXdg = process.env.XDG_CONFIG_HOME;
		const originalExitCode = process.exitCode;
		const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gitface-e2e-"));
		const configDir = path.join(tmpRoot, "config");
		const importFile = path.join(tmpRoot, "profiles.json");
		const logs: string[] = [];
		const restoreLog = spyConsole(logs);

		try {
			process.env.XDG_CONFIG_HOME = configDir;
			const service = ProfileService.create();
			await service.createProfile({
				name: "work",
				gitName: "Work User",
				email: "work@example.com",
			});

			await fs.writeFile(
				importFile,
				JSON.stringify(
					[
						{
							name: "work",
							gitName: "Work User",
							email: "work@example.com",
						},
						{
							name: "personal",
							gitName: "Personal User",
							email: "me@example.com",
						},
					],
					null,
					2,
				),
				"utf8",
			);

			await runCli([importProfileCommand.command], [
				"node",
				"gitface",
				"import",
				importFile,
				"--dry-run",
			]);

			const output = stripAnsi(logs.join("\n"));
			expect(output).toMatch(/\[dry-run\] Profile 'work' already exists/i);
			expect(output).toMatch(/Dry-run complete\. 1 profiles ready to import\./i);

			const profiles = await service.listProfiles();
			expect(profiles.map((profile) => profile.name)).toEqual(["work"]);
		} finally {
			restoreLog();
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
