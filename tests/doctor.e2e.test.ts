import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import simpleGit from "simple-git";
import { describe, expect, test, vi } from "vitest";
import { doctorCommand } from "../src/commands/index";
import { runCli, safeRemove } from "./helpers/e2e";

describe("doctor command e2e", () => {
	test("warns when only local identity exists but global identity is missing", async () => {
		const originalXdg = process.env.XDG_CONFIG_HOME;
		const originalGlobalConfig = process.env.GIT_CONFIG_GLOBAL;
		const originalArgv = process.argv.slice();
		const originalExitCode = process.exitCode;
		const originalCwd = process.cwd();
		const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gitface-cli-"));
		const repoDir = path.join(tmpRoot, "repo");
		const configDir = path.join(tmpRoot, "config");
		const globalConfigPath = path.join(tmpRoot, "global.gitconfig");
		await fs.mkdir(repoDir);
		await fs.writeFile(globalConfigPath, "", "utf8");
		const git = simpleGit({ baseDir: repoDir });
		await git.init();
		await git.addConfig("user.name", "Doctor User");
		await git.addConfig("user.email", "doctor@example.com");

		const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

		try {
			process.chdir(repoDir);
			process.env.XDG_CONFIG_HOME = configDir;
			process.env.GIT_CONFIG_GLOBAL = globalConfigPath;
			process.exitCode = undefined;

			await runCli([doctorCommand.command], ["node", "gitface", "doctor"]);

			const output = logSpy.mock.calls.flat().join("\n");
			expect(output).toContain("GitFace Doctor");
			expect(output).toContain("Global Git identity is missing");
			expect(output).not.toContain(
				"Global Git identity is set: Doctor User <doctor@example.com>",
			);
			expect(process.exitCode).toBeUndefined();
		} finally {
			logSpy.mockRestore();
			process.chdir(originalCwd);
			process.argv = originalArgv;
			if (originalXdg === undefined) delete process.env.XDG_CONFIG_HOME;
			else process.env.XDG_CONFIG_HOME = originalXdg;
			if (originalGlobalConfig === undefined)
				delete process.env.GIT_CONFIG_GLOBAL;
			else process.env.GIT_CONFIG_GLOBAL = originalGlobalConfig;
			process.exitCode = originalExitCode;
			await safeRemove(tmpRoot);
		}
	});

	test("returns exit code 1 in strict mode when warnings are present", async () => {
		const originalXdg = process.env.XDG_CONFIG_HOME;
		const originalGlobalConfig = process.env.GIT_CONFIG_GLOBAL;
		const originalArgv = process.argv.slice();
		const originalExitCode = process.exitCode;
		const originalCwd = process.cwd();
		const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gitface-cli-"));
		const repoDir = path.join(tmpRoot, "repo");
		const configDir = path.join(tmpRoot, "config");
		const globalConfigPath = path.join(tmpRoot, "global.gitconfig");
		await fs.mkdir(repoDir);
		await fs.writeFile(globalConfigPath, "", "utf8");
		const git = simpleGit({ baseDir: repoDir });
		await git.init();
		await git.addConfig("user.name", "Doctor User");
		await git.addConfig("user.email", "doctor@example.com");

		const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

		try {
			process.chdir(repoDir);
			process.env.XDG_CONFIG_HOME = configDir;
			process.env.GIT_CONFIG_GLOBAL = globalConfigPath;
			process.exitCode = undefined;

			await runCli(
				[doctorCommand.command],
				["node", "gitface", "doctor", "--strict"],
			);

			const output = logSpy.mock.calls.flat().join("\n");
			expect(output).toContain("Global Git identity is missing");
			expect(output).toContain(
				"Strict mode failed because warnings were detected",
			);
			expect(process.exitCode).toBe(1);
		} finally {
			logSpy.mockRestore();
			process.chdir(originalCwd);
			process.argv = originalArgv;
			if (originalXdg === undefined) delete process.env.XDG_CONFIG_HOME;
			else process.env.XDG_CONFIG_HOME = originalXdg;
			if (originalGlobalConfig === undefined)
				delete process.env.GIT_CONFIG_GLOBAL;
			else process.env.GIT_CONFIG_GLOBAL = originalGlobalConfig;
			process.exitCode = originalExitCode;
			await safeRemove(tmpRoot);
		}
	});

	test("outputs machine-readable JSON with explicit global identity", async () => {
		const originalXdg = process.env.XDG_CONFIG_HOME;
		const originalGlobalConfig = process.env.GIT_CONFIG_GLOBAL;
		const originalArgv = process.argv.slice();
		const originalExitCode = process.exitCode;
		const originalCwd = process.cwd();
		const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gitface-cli-"));
		const repoDir = path.join(tmpRoot, "repo");
		const configDir = path.join(tmpRoot, "config");
		const globalConfigPath = path.join(tmpRoot, "global.gitconfig");
		await fs.mkdir(repoDir);
		await fs.writeFile(
			globalConfigPath,
			`[user]
	name = Global Doctor
	email = global-doctor@example.com
`,
			"utf8",
		);
		const git = simpleGit({ baseDir: repoDir });
		await git.init();

		const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

		try {
			process.chdir(repoDir);
			process.env.XDG_CONFIG_HOME = configDir;
			process.env.GIT_CONFIG_GLOBAL = globalConfigPath;
			process.exitCode = undefined;

			await runCli(
				[doctorCommand.command],
				["node", "gitface", "doctor", "--json"],
			);

			const output = logSpy.mock.calls.flat().join("\n");
			const parsed = JSON.parse(output) as {
				checks: { status: string; message: string }[];
				hasFailures: boolean;
				hasWarnings: boolean;
			};

			expect(parsed.checks).toHaveLength(3);
			expect(parsed.hasFailures).toBe(false);
			expect(parsed.hasWarnings).toBe(false);
			expect(
				parsed.checks.some(
					(check) =>
						check.status === "pass" &&
						check.message.includes(
							"Global Git identity is set: Global Doctor <global-doctor@example.com>",
						),
				),
			).toBe(true);
			expect(parsed.checks.every((check) => check.message.length > 0)).toBe(
				true,
			);
			expect(
				parsed.checks.every((check) =>
					["pass", "warn", "fail"].includes(check.status),
				),
			).toBe(true);
			expect(process.exitCode).toBeUndefined();
		} finally {
			logSpy.mockRestore();
			process.chdir(originalCwd);
			process.argv = originalArgv;
			if (originalXdg === undefined) delete process.env.XDG_CONFIG_HOME;
			else process.env.XDG_CONFIG_HOME = originalXdg;
			if (originalGlobalConfig === undefined)
				delete process.env.GIT_CONFIG_GLOBAL;
			else process.env.GIT_CONFIG_GLOBAL = originalGlobalConfig;
			process.exitCode = originalExitCode;
			await safeRemove(tmpRoot);
		}
	});

	test("emits warning metadata and non-zero exit in strict json mode", async () => {
		const originalXdg = process.env.XDG_CONFIG_HOME;
		const originalGlobalConfig = process.env.GIT_CONFIG_GLOBAL;
		const originalArgv = process.argv.slice();
		const originalExitCode = process.exitCode;
		const originalCwd = process.cwd();
		const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gitface-cli-"));
		const repoDir = path.join(tmpRoot, "repo");
		const configDir = path.join(tmpRoot, "config");
		const globalConfigPath = path.join(tmpRoot, "global.gitconfig");
		await fs.mkdir(repoDir);
		await fs.writeFile(globalConfigPath, "", "utf8");
		const git = simpleGit({ baseDir: repoDir });
		await git.init();
		await git.addConfig("user.name", "Doctor User");
		await git.addConfig("user.email", "doctor@example.com");

		const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

		try {
			process.chdir(repoDir);
			process.env.XDG_CONFIG_HOME = configDir;
			process.env.GIT_CONFIG_GLOBAL = globalConfigPath;
			process.exitCode = undefined;

			await runCli(
				[doctorCommand.command],
				["node", "gitface", "doctor", "--strict", "--json"],
			);

			const output = logSpy.mock.calls.flat().join("\n");
			const parsed = JSON.parse(output) as {
				checks: { status: string; message: string }[];
				hasFailures: boolean;
				hasWarnings: boolean;
			};

			expect(parsed.checks).toHaveLength(3);
			expect(parsed.hasFailures).toBe(false);
			expect(parsed.hasWarnings).toBe(true);
			expect(parsed.checks.some((check) => check.status === "warn")).toBe(true);
			expect(process.exitCode).toBe(1);
		} finally {
			logSpy.mockRestore();
			process.chdir(originalCwd);
			process.argv = originalArgv;
			if (originalXdg === undefined) delete process.env.XDG_CONFIG_HOME;
			else process.env.XDG_CONFIG_HOME = originalXdg;
			if (originalGlobalConfig === undefined)
				delete process.env.GIT_CONFIG_GLOBAL;
			else process.env.GIT_CONFIG_GLOBAL = originalGlobalConfig;
			process.exitCode = originalExitCode;
			await safeRemove(tmpRoot);
		}
	});

	test("outputs unified result envelope in json-envelope mode", async () => {
		const originalXdg = process.env.XDG_CONFIG_HOME;
		const originalGlobalConfig = process.env.GIT_CONFIG_GLOBAL;
		const originalArgv = process.argv.slice();
		const originalExitCode = process.exitCode;
		const originalCwd = process.cwd();
		const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gitface-cli-"));
		const repoDir = path.join(tmpRoot, "repo");
		const configDir = path.join(tmpRoot, "config");
		const globalConfigPath = path.join(tmpRoot, "global.gitconfig");
		await fs.mkdir(repoDir);
		await fs.writeFile(
			globalConfigPath,
			`[user]
	name = Envelope Doctor
	email = envelope-doctor@example.com
`,
			"utf8",
		);
		const git = simpleGit({ baseDir: repoDir });
		await git.init();

		const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

		try {
			process.chdir(repoDir);
			process.env.XDG_CONFIG_HOME = configDir;
			process.env.GIT_CONFIG_GLOBAL = globalConfigPath;
			process.exitCode = undefined;

			await runCli(
				[doctorCommand.command],
				["node", "gitface", "doctor", "--json-envelope"],
			);

			const output = logSpy.mock.calls.flat().join("\n");
			const parsed = JSON.parse(output) as {
				status: "success" | "error";
				code: string;
				message: string;
				data: {
					strict: boolean;
					hasFatalChecks: boolean;
					summary: { total: number; pass: number; warn: number; fail: number };
					checks: { status: string; message: string }[];
				} | null;
				errors: { code: string; message: string }[];
				meta: { schemaVersion: string; durationMs: number; traceId: string };
			};

			expect(parsed.status).toBe("success");
			expect(parsed.code).toBe("DOCTOR_CHECKS_OK");
			expect(parsed.data?.strict).toBe(false);
			expect(parsed.data?.hasFatalChecks).toBe(false);
			expect(parsed.data?.summary).toEqual({
				total: 3,
				pass: 3,
				warn: 0,
				fail: 0,
			});
			expect(parsed.data?.checks).toHaveLength(3);
			expect(parsed.errors).toEqual([]);
			expect(parsed.meta.schemaVersion).toBe("1.0.0");
			expect(parsed.meta.durationMs).toBeGreaterThanOrEqual(0);
			expect(parsed.meta.traceId.length).toBeGreaterThan(0);
			expect(process.exitCode).toBeUndefined();
		} finally {
			logSpy.mockRestore();
			process.chdir(originalCwd);
			process.argv = originalArgv;
			if (originalXdg === undefined) delete process.env.XDG_CONFIG_HOME;
			else process.env.XDG_CONFIG_HOME = originalXdg;
			if (originalGlobalConfig === undefined)
				delete process.env.GIT_CONFIG_GLOBAL;
			else process.env.GIT_CONFIG_GLOBAL = originalGlobalConfig;
			process.exitCode = originalExitCode;
			await safeRemove(tmpRoot);
		}
	});

	test("emits error envelope and exit code 1 in strict json-envelope mode", async () => {
		const originalXdg = process.env.XDG_CONFIG_HOME;
		const originalGlobalConfig = process.env.GIT_CONFIG_GLOBAL;
		const originalArgv = process.argv.slice();
		const originalExitCode = process.exitCode;
		const originalCwd = process.cwd();
		const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gitface-cli-"));
		const repoDir = path.join(tmpRoot, "repo");
		const configDir = path.join(tmpRoot, "config");
		const globalConfigPath = path.join(tmpRoot, "global.gitconfig");
		await fs.mkdir(repoDir);
		await fs.writeFile(globalConfigPath, "", "utf8");
		const git = simpleGit({ baseDir: repoDir });
		await git.init();
		await git.addConfig("user.name", "Doctor User");
		await git.addConfig("user.email", "doctor@example.com");

		const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

		try {
			process.chdir(repoDir);
			process.env.XDG_CONFIG_HOME = configDir;
			process.env.GIT_CONFIG_GLOBAL = globalConfigPath;
			process.exitCode = undefined;

			await runCli(
				[doctorCommand.command],
				["node", "gitface", "doctor", "--strict", "--json-envelope"],
			);

			const output = logSpy.mock.calls.flat().join("\n");
			const parsed = JSON.parse(output) as {
				status: "success" | "error";
				code: string;
				data: {
					strict: boolean;
					hasFatalChecks: boolean;
					summary: { total: number; pass: number; warn: number; fail: number };
				} | null;
				errors: { code: string; message: string }[];
			};

			expect(parsed.status).toBe("error");
			expect(parsed.code).toBe("DOCTOR_CHECKS_FAILED");
			expect(parsed.data?.strict).toBe(true);
			expect(parsed.data?.hasFatalChecks).toBe(true);
			expect(parsed.data?.summary.warn).toBeGreaterThanOrEqual(1);
			expect(
				parsed.errors.some(
					(error) => error.code === "DOCTOR_CHECK_WARN_STRICT",
				),
			).toBe(true);
			expect(process.exitCode).toBe(1);
		} finally {
			logSpy.mockRestore();
			process.chdir(originalCwd);
			process.argv = originalArgv;
			if (originalXdg === undefined) delete process.env.XDG_CONFIG_HOME;
			else process.env.XDG_CONFIG_HOME = originalXdg;
			if (originalGlobalConfig === undefined)
				delete process.env.GIT_CONFIG_GLOBAL;
			else process.env.GIT_CONFIG_GLOBAL = originalGlobalConfig;
			process.exitCode = originalExitCode;
			await safeRemove(tmpRoot);
		}
	});
});
