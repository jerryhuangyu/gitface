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
	test("emits structured export summary with profiles for export --json", async () => {
		const originalXdg = process.env.XDG_CONFIG_HOME;
		const originalExitCode = process.exitCode;
		const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gitface-e2e-"));
		const configDir = path.join(tmpRoot, "config");
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
			await service.createProfile({
				name: "personal",
				gitName: "Personal User",
				email: "me@example.com",
			});

			await runCli(
				[exportProfileCommand.command],
				["node", "gitface", "export", "--json"],
			);

			const summary = JSON.parse(logs.join("\n")) as {
				status: string;
				count: number;
				profiles: Array<{
					name: string;
					gitName: string;
					email: string;
					signingKey: string | null;
				}>;
			};

			expect(summary.status).toBe("exported");
			expect(summary.count).toBe(2);
			expect(summary.profiles).toHaveLength(2);
			expect(summary.profiles.map((profile) => profile.name).sort()).toEqual([
				"personal",
				"work",
			]);
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

	test("emits structured export summary with file path for export <file> --json", async () => {
		const originalXdg = process.env.XDG_CONFIG_HOME;
		const originalExitCode = process.exitCode;
		const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gitface-e2e-"));
		const configDir = path.join(tmpRoot, "config");
		const exportFile = path.join(tmpRoot, "profiles.json");
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

			await runCli(
				[exportProfileCommand.command],
				["node", "gitface", "export", exportFile, "--json"],
			);

			const summary = JSON.parse(logs.join("\n")) as {
				status: string;
				count: number;
				file: string;
			};

			expect(summary).toEqual({
				status: "exported",
				count: 1,
				file: exportFile,
			});

			const exportedContent = JSON.parse(
				await fs.readFile(exportFile, "utf8"),
			) as Array<Record<string, unknown>>;
			expect(exportedContent).toHaveLength(1);
			expect(exportedContent[0]?.name).toBe("work");
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

	test("emits JSON error and exit code when export --json write fails", async () => {
		const originalXdg = process.env.XDG_CONFIG_HOME;
		const originalExitCode = process.exitCode;
		const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gitface-e2e-"));
		const configDir = path.join(tmpRoot, "config");
		const invalidOutput = path.join(tmpRoot, "output-dir");
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
			await fs.mkdir(invalidOutput, { recursive: true });

			await runCli(
				[exportProfileCommand.command],
				["node", "gitface", "export", invalidOutput, "--json"],
			);

			const summary = JSON.parse(logs.join("\n")) as {
				status: string;
				reason: string;
				file: string;
			};
			expect(summary.status).toBe("error");
			expect(summary.file).toBe(invalidOutput);
			expect(summary.reason.length).toBeGreaterThan(0);
			expect(process.exitCode).toBe(1);
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
			expect(imported.map((p) => p.name).sort()).toEqual(["personal", "work"]);

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

			await runCli(
				[importProfileCommand.command],
				["node", "gitface", "import", importFile, "--dry-run"],
			);

			const output = stripAnsi(logs.join("\n"));
			expect(output).toMatch(/\[dry-run\] Profile 'work' already exists/i);
			expect(output).toMatch(
				/Dry-run complete\. 1 profiles ready to import\./i,
			);

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

	test("emits structured results for import --json", async () => {
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

			await runCli(
				[importProfileCommand.command],
				["node", "gitface", "import", importFile, "--json"],
			);

			const summary = JSON.parse(logs.join("\n")) as {
				dryRun: boolean;
				total: number;
				imported: number;
				failed: number;
				results: Array<{ name: string; status: string; message: string }>;
			};

			expect(summary.dryRun).toBe(false);
			expect(summary.total).toBe(2);
			expect(summary.imported).toBe(1);
			expect(summary.failed).toBe(1);
			expect(summary.results).toEqual([
				{
					name: "work",
					status: "failed",
					message: "Profile already exists. Use --overwrite to replace.",
				},
				{
					name: "personal",
					status: "imported",
					message: "Imported.",
				},
			]);

			const profiles = await service.listProfiles();
			expect(profiles.map((profile) => profile.name).sort()).toEqual([
				"personal",
				"work",
			]);
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

	test("emits structured results for import --dry-run --json without writes", async () => {
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

			await runCli(
				[importProfileCommand.command],
				["node", "gitface", "import", importFile, "--dry-run", "--json"],
			);

			const summary = JSON.parse(logs.join("\n")) as {
				dryRun: boolean;
				total: number;
				imported: number;
				failed: number;
				results: Array<{ name: string; status: string; message: string }>;
			};

			expect(summary.dryRun).toBe(true);
			expect(summary.total).toBe(2);
			expect(summary.imported).toBe(1);
			expect(summary.failed).toBe(1);
			expect(summary.results).toEqual([
				{
					name: "work",
					status: "failed",
					message: "Profile already exists. Use --overwrite to replace.",
				},
				{
					name: "personal",
					status: "imported",
					message: "Validated for import.",
				},
			]);

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

	test("aborts whole import for --atomic when any entry fails precheck", async () => {
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
				gitName: "Existing User",
				email: "existing@example.com",
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

			await runCli(
				[importProfileCommand.command],
				["node", "gitface", "import", importFile, "--atomic", "--json"],
			);

			const summary = JSON.parse(logs.join("\n")) as {
				dryRun: boolean;
				total: number;
				imported: number;
				failed: number;
				results: Array<{ name: string; status: string; message: string }>;
			};
			expect(summary.dryRun).toBe(false);
			expect(summary.total).toBe(2);
			expect(summary.imported).toBe(0);
			expect(summary.failed).toBe(2);
			expect(summary.results).toEqual([
				{
					name: "work",
					status: "failed",
					message: "Profile 'work' already exists.",
				},
				{
					name: "personal",
					status: "failed",
					message: "Skipped due to --atomic precheck failure.",
				},
			]);
			expect(process.exitCode).toBe(1);

			const profiles = await service.listProfiles();
			expect(profiles).toHaveLength(1);
			expect(profiles[0]?.name).toBe("work");
			expect(profiles[0]?.gitName).toBe("Existing User");
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

	test("imports all entries for --atomic --overwrite when precheck succeeds", async () => {
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
				gitName: "Existing User",
				email: "existing@example.com",
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

			await runCli(
				[importProfileCommand.command],
				[
					"node",
					"gitface",
					"import",
					importFile,
					"--atomic",
					"--overwrite",
					"--json",
				],
			);

			const summary = JSON.parse(logs.join("\n")) as {
				dryRun: boolean;
				total: number;
				imported: number;
				failed: number;
			};
			expect(summary.dryRun).toBe(false);
			expect(summary.total).toBe(2);
			expect(summary.imported).toBe(2);
			expect(summary.failed).toBe(0);
			expect(process.exitCode).toBeUndefined();

			const profiles = await service.listProfiles();
			expect(profiles.map((profile) => profile.name).sort()).toEqual([
				"personal",
				"work",
			]);
			expect(profiles.find((profile) => profile.name === "work")?.gitName).toBe(
				"Work User",
			);
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

	test("sets non-zero exit code when import --strict has failed entries", async () => {
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

			await runCli(
				[importProfileCommand.command],
				["node", "gitface", "import", importFile, "--strict"],
			);

			expect(process.exitCode).toBe(1);
			const output = stripAnsi(logs.join("\n"));
			expect(output).toMatch(/Profile 'work' already exists/i);
			expect(output).toMatch(/Imported 1 profiles\./i);
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

	test("sets non-zero exit code for import --dry-run --json --strict on validation failures", async () => {
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

			await runCli(
				[importProfileCommand.command],
				[
					"node",
					"gitface",
					"import",
					importFile,
					"--dry-run",
					"--json",
					"--strict",
				],
			);

			const summary = JSON.parse(logs.join("\n")) as {
				dryRun: boolean;
				total: number;
				imported: number;
				failed: number;
			};
			expect(summary.dryRun).toBe(true);
			expect(summary.total).toBe(2);
			expect(summary.imported).toBe(1);
			expect(summary.failed).toBe(1);
			expect(process.exitCode).toBe(1);

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

	test("emits result envelope for import --json-envelope partial failures", async () => {
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

			await runCli(
				[importProfileCommand.command],
				["node", "gitface", "import", importFile, "--json-envelope"],
			);

			const envelope = JSON.parse(logs.join("\n")) as {
				status: string;
				code: string;
				data: {
					file: string;
					strict: boolean;
					overwrite: boolean;
					atomic: boolean;
					dryRun: boolean;
					total: number;
					imported: number;
					failed: number;
				};
				errors: Array<{ code: string; message: string }>;
				meta: { schemaVersion: string; durationMs: number; traceId: string };
			};

			expect(envelope.status).toBe("success");
			expect(envelope.code).toBe("IMPORT_PROFILES_PARTIAL");
			expect(envelope.data).toMatchObject({
				file: importFile,
				strict: false,
				overwrite: false,
				atomic: false,
				dryRun: false,
				total: 2,
				imported: 1,
				failed: 1,
			});
			expect(envelope.errors).toEqual([]);
			expect(envelope.meta.schemaVersion).toBe("1.0.0");
			expect(typeof envelope.meta.durationMs).toBe("number");
			expect(envelope.meta.traceId.length).toBeGreaterThan(0);
			expect(process.exitCode).toBeUndefined();
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

	test("emits error envelope and exit code for import --atomic --json-envelope precheck failures", async () => {
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
				gitName: "Existing User",
				email: "existing@example.com",
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

			await runCli(
				[importProfileCommand.command],
				[
					"node",
					"gitface",
					"import",
					importFile,
					"--atomic",
					"--json-envelope",
				],
			);

			const envelope = JSON.parse(logs.join("\n")) as {
				status: string;
				code: string;
				data: {
					atomic: boolean;
					failed: number;
				};
				errors: Array<{ code: string; message: string }>;
				meta: { schemaVersion: string };
			};

			expect(envelope.status).toBe("error");
			expect(envelope.code).toBe("IMPORT_PROFILES_ATOMIC_ABORTED");
			expect(envelope.data.atomic).toBe(true);
			expect(envelope.data.failed).toBe(2);
			expect(envelope.errors).toHaveLength(2);
			expect(envelope.meta.schemaVersion).toBe("1.0.0");
			expect(process.exitCode).toBe(1);
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
