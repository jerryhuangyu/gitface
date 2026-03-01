import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test, vi } from "vitest";
import { completionCommand } from "../src/commands/index";
import { ProfileService } from "../src/core/profile-service";
import { runCli, safeRemove } from "./helpers/e2e";

function captureStdout(buffer: string[]): () => void {
	const spy = vi.spyOn(process.stdout, "write").mockImplementation(((
		chunk: string | Uint8Array,
	) => {
		buffer.push(
			typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"),
		);
		return true;
	}) as typeof process.stdout.write);

	return () => spy.mockRestore();
}

describe("completion command e2e", () => {
	test("returns prefix-filtered profile names for profiles topic", async () => {
		const originalXdg = process.env.XDG_CONFIG_HOME;
		const originalExitCode = process.exitCode;
		const tmpRoot = await fs.mkdtemp(
			path.join(os.tmpdir(), "gitface-completion-"),
		);
		const configDir = path.join(tmpRoot, "config");
		const output: string[] = [];
		const restoreStdout = captureStdout(output);

		try {
			process.env.XDG_CONFIG_HOME = configDir;
			process.exitCode = undefined;

			const service = ProfileService.create();
			await service.createProfile({
				name: "work",
				gitName: "Work User",
				email: "work@example.com",
			});
			await service.createProfile({
				name: "home",
				gitName: "Home User",
				email: "home@example.com",
			});

			await runCli(
				[completionCommand.command],
				["node", "gitface", "completion", "profiles", "--prefix", "wo"],
			);

			expect(output.join("")).toBe("work\n");
			expect(process.exitCode).toBeUndefined();
		} finally {
			if (originalXdg === undefined) {
				delete process.env.XDG_CONFIG_HOME;
			} else {
				process.env.XDG_CONFIG_HOME = originalXdg;
			}
			process.exitCode = originalExitCode;
			restoreStdout();
			await safeRemove(tmpRoot);
		}
	});

	test("matches --prefix case-insensitively", async () => {
		const originalXdg = process.env.XDG_CONFIG_HOME;
		const originalExitCode = process.exitCode;
		const tmpRoot = await fs.mkdtemp(
			path.join(os.tmpdir(), "gitface-completion-"),
		);
		const configDir = path.join(tmpRoot, "config");
		const output: string[] = [];
		const restoreStdout = captureStdout(output);

		try {
			process.env.XDG_CONFIG_HOME = configDir;
			process.exitCode = undefined;

			const service = ProfileService.create();
			await service.createProfile({
				name: "WorkAdmin",
				gitName: "Work Admin",
				email: "work-admin@example.com",
			});

			await runCli(
				[completionCommand.command],
				["node", "gitface", "completion", "profiles", "--prefix", "wo"],
			);

			expect(output.join("")).toBe("WorkAdmin\n");
			expect(process.exitCode).toBeUndefined();
		} finally {
			if (originalXdg === undefined) {
				delete process.env.XDG_CONFIG_HOME;
			} else {
				process.env.XDG_CONFIG_HOME = originalXdg;
			}
			process.exitCode = originalExitCode;
			restoreStdout();
			await safeRemove(tmpRoot);
		}
	});

	test("limits returned profile names with --limit", async () => {
		const originalXdg = process.env.XDG_CONFIG_HOME;
		const originalExitCode = process.exitCode;
		const tmpRoot = await fs.mkdtemp(
			path.join(os.tmpdir(), "gitface-completion-"),
		);
		const configDir = path.join(tmpRoot, "config");
		const output: string[] = [];
		const restoreStdout = captureStdout(output);

		try {
			process.env.XDG_CONFIG_HOME = configDir;
			process.exitCode = undefined;

			const service = ProfileService.create();
			await service.createProfile({
				name: "alpha",
				gitName: "Alpha User",
				email: "alpha@example.com",
			});
			await service.createProfile({
				name: "alpine",
				gitName: "Alpine User",
				email: "alpine@example.com",
			});
			await service.createProfile({
				name: "alps",
				gitName: "Alps User",
				email: "alps@example.com",
			});

			await runCli(
				[completionCommand.command],
				[
					"node",
					"gitface",
					"completion",
					"profiles",
					"--prefix",
					"al",
					"--limit",
					"2",
				],
			);

			expect(output.join("")).toBe("alpha\nalpine\n");
			expect(process.exitCode).toBeUndefined();
		} finally {
			if (originalXdg === undefined) {
				delete process.env.XDG_CONFIG_HOME;
			} else {
				process.env.XDG_CONFIG_HOME = originalXdg;
			}
			process.exitCode = originalExitCode;
			restoreStdout();
			await safeRemove(tmpRoot);
		}
	});

	test("emits machine-readable payload with --json", async () => {
		const originalXdg = process.env.XDG_CONFIG_HOME;
		const originalExitCode = process.exitCode;
		const tmpRoot = await fs.mkdtemp(
			path.join(os.tmpdir(), "gitface-completion-"),
		);
		const configDir = path.join(tmpRoot, "config");
		const output: string[] = [];
		const restoreStdout = captureStdout(output);

		try {
			process.env.XDG_CONFIG_HOME = configDir;
			process.exitCode = undefined;

			const service = ProfileService.create();
			await service.createProfile({
				name: "work-admin",
				gitName: "Work Admin",
				email: "work-admin@example.com",
			});
			await service.createProfile({
				name: "home",
				gitName: "Home User",
				email: "home@example.com",
			});

			await runCli(
				[completionCommand.command],
				[
					"node",
					"gitface",
					"completion",
					"profiles",
					"--prefix",
					"wo",
					"--limit",
					"1",
					"--json",
				],
			);

			expect(JSON.parse(output.join(""))).toEqual({
				topic: "profiles",
				prefix: "wo",
				limit: 1,
				count: 1,
				names: ["work-admin"],
			});
			expect(process.exitCode).toBeUndefined();
		} finally {
			if (originalXdg === undefined) {
				delete process.env.XDG_CONFIG_HOME;
			} else {
				process.env.XDG_CONFIG_HOME = originalXdg;
			}
			process.exitCode = originalExitCode;
			restoreStdout();
			await safeRemove(tmpRoot);
		}
	});

	test("emits empty json payload when no completion matches", async () => {
		const originalXdg = process.env.XDG_CONFIG_HOME;
		const originalExitCode = process.exitCode;
		const tmpRoot = await fs.mkdtemp(
			path.join(os.tmpdir(), "gitface-completion-"),
		);
		const configDir = path.join(tmpRoot, "config");
		const output: string[] = [];
		const restoreStdout = captureStdout(output);

		try {
			process.env.XDG_CONFIG_HOME = configDir;
			process.exitCode = undefined;

			const service = ProfileService.create();
			await service.createProfile({
				name: "home",
				gitName: "Home User",
				email: "home@example.com",
			});

			await runCli(
				[completionCommand.command],
				[
					"node",
					"gitface",
					"completion",
					"profiles",
					"--prefix",
					"wo",
					"--json",
				],
			);

			expect(JSON.parse(output.join(""))).toEqual({
				topic: "profiles",
				prefix: "wo",
				limit: null,
				count: 0,
				names: [],
			});
			expect(process.exitCode).toBeUndefined();
		} finally {
			if (originalXdg === undefined) {
				delete process.env.XDG_CONFIG_HOME;
			} else {
				process.env.XDG_CONFIG_HOME = originalXdg;
			}
			process.exitCode = originalExitCode;
			restoreStdout();
			await safeRemove(tmpRoot);
		}
	});

	test("emits result envelope payload with --json-envelope", async () => {
		const originalXdg = process.env.XDG_CONFIG_HOME;
		const originalExitCode = process.exitCode;
		const tmpRoot = await fs.mkdtemp(
			path.join(os.tmpdir(), "gitface-completion-"),
		);
		const configDir = path.join(tmpRoot, "config");
		const output: string[] = [];
		const restoreStdout = captureStdout(output);

		try {
			process.env.XDG_CONFIG_HOME = configDir;
			process.exitCode = undefined;

			const service = ProfileService.create();
			await service.createProfile({
				name: "work-admin",
				gitName: "Work Admin",
				email: "work-admin@example.com",
			});

			await runCli(
				[completionCommand.command],
				[
					"node",
					"gitface",
					"completion",
					"profiles",
					"--prefix",
					"wo",
					"--limit",
					"1",
					"--json-envelope",
				],
			);

			const payload = JSON.parse(output.join(""));
			expect(payload.status).toBe("success");
			expect(payload.code).toBe("COMPLETION_PROFILES_OK");
			expect(payload.message).toBe("Completion profiles resolved.");
			expect(payload.errors).toEqual([]);
			expect(payload.data).toEqual({
				topic: "profiles",
				prefix: "wo",
				limit: 1,
				count: 1,
				names: ["work-admin"],
			});
			expect(payload.meta.schemaVersion).toBe("1.0.0");
			expect(typeof payload.meta.durationMs).toBe("number");
			expect(payload.meta.durationMs).toBeGreaterThanOrEqual(0);
			expect(typeof payload.meta.traceId).toBe("string");
			expect(payload.meta.traceId.length).toBeGreaterThan(0);
			expect(process.exitCode).toBeUndefined();
		} finally {
			if (originalXdg === undefined) {
				delete process.env.XDG_CONFIG_HOME;
			} else {
				process.env.XDG_CONFIG_HOME = originalXdg;
			}
			process.exitCode = originalExitCode;
			restoreStdout();
			await safeRemove(tmpRoot);
		}
	});

	test("sets exit code and writes no output for invalid --limit", async () => {
		const originalXdg = process.env.XDG_CONFIG_HOME;
		const originalExitCode = process.exitCode;
		const tmpRoot = await fs.mkdtemp(
			path.join(os.tmpdir(), "gitface-completion-"),
		);
		const configDir = path.join(tmpRoot, "config");
		const output: string[] = [];
		const restoreStdout = captureStdout(output);

		try {
			process.env.XDG_CONFIG_HOME = configDir;
			process.exitCode = undefined;

			const service = ProfileService.create();
			await service.createProfile({
				name: "work",
				gitName: "Work User",
				email: "work@example.com",
			});

			await runCli(
				[completionCommand.command],
				[
					"node",
					"gitface",
					"completion",
					"profiles",
					"--prefix",
					"wo",
					"--limit",
					"0",
				],
			);

			expect(process.exitCode).toBe(1);
			expect(output.join("")).toBe("");
		} finally {
			if (originalXdg === undefined) {
				delete process.env.XDG_CONFIG_HOME;
			} else {
				process.env.XDG_CONFIG_HOME = originalXdg;
			}
			process.exitCode = originalExitCode;
			restoreStdout();
			await safeRemove(tmpRoot);
		}
	});

	test("returns result envelope error for invalid --limit with --json-envelope", async () => {
		const originalXdg = process.env.XDG_CONFIG_HOME;
		const originalExitCode = process.exitCode;
		const tmpRoot = await fs.mkdtemp(
			path.join(os.tmpdir(), "gitface-completion-"),
		);
		const configDir = path.join(tmpRoot, "config");
		const output: string[] = [];
		const restoreStdout = captureStdout(output);

		try {
			process.env.XDG_CONFIG_HOME = configDir;
			process.exitCode = undefined;

			const service = ProfileService.create();
			await service.createProfile({
				name: "work",
				gitName: "Work User",
				email: "work@example.com",
			});

			await runCli(
				[completionCommand.command],
				[
					"node",
					"gitface",
					"completion",
					"profiles",
					"--prefix",
					"wo",
					"--limit",
					"0",
					"--json-envelope",
				],
			);

			const payload = JSON.parse(output.join(""));
			expect(payload.status).toBe("error");
			expect(payload.code).toBe("COMPLETION_LIMIT_INVALID");
			expect(payload.message).toBe("Limit must be a positive integer.");
			expect(payload.data).toBeNull();
			expect(payload.errors).toEqual([
				{
					code: "COMPLETION_LIMIT_INVALID",
					message: "Limit must be a positive integer.",
				},
			]);
			expect(payload.meta.schemaVersion).toBe("1.0.0");
			expect(process.exitCode).toBe(1);
		} finally {
			if (originalXdg === undefined) {
				delete process.env.XDG_CONFIG_HOME;
			} else {
				process.env.XDG_CONFIG_HOME = originalXdg;
			}
			process.exitCode = originalExitCode;
			restoreStdout();
			await safeRemove(tmpRoot);
		}
	});

	test("returns filtered profile names even when unrelated profile JSON is malformed", async () => {
		const originalXdg = process.env.XDG_CONFIG_HOME;
		const originalExitCode = process.exitCode;
		const tmpRoot = await fs.mkdtemp(
			path.join(os.tmpdir(), "gitface-completion-"),
		);
		const configDir = path.join(tmpRoot, "config");
		const output: string[] = [];
		const restoreStdout = captureStdout(output);

		try {
			process.env.XDG_CONFIG_HOME = configDir;
			process.exitCode = undefined;

			const service = ProfileService.create();
			await service.createProfile({
				name: "work",
				gitName: "Work User",
				email: "work@example.com",
			});

			const profilesDir = path.join(configDir, "gitface", "profiles");
			await fs.writeFile(
				path.join(profilesDir, "oops.json"),
				"{not-valid-json",
			);

			await runCli(
				[completionCommand.command],
				["node", "gitface", "completion", "profiles", "--prefix", "wo"],
			);

			expect(output.join("")).toBe("work\n");
			expect(process.exitCode).toBeUndefined();
		} finally {
			if (originalXdg === undefined) {
				delete process.env.XDG_CONFIG_HOME;
			} else {
				process.env.XDG_CONFIG_HOME = originalXdg;
			}
			process.exitCode = originalExitCode;
			restoreStdout();
			await safeRemove(tmpRoot);
		}
	});

	test("sets exit code for unsupported completion topic", async () => {
		const originalExitCode = process.exitCode;
		const output: string[] = [];
		const restoreStdout = captureStdout(output);

		try {
			process.exitCode = undefined;
			await runCli(
				[completionCommand.command],
				["node", "gitface", "completion", "invalid-topic"],
			);

			expect(process.exitCode).toBe(1);
			expect(output.join("")).toBe("");
		} finally {
			process.exitCode = originalExitCode;
			restoreStdout();
		}
	});

	test("returns result envelope error for unsupported topic with --json-envelope", async () => {
		const originalExitCode = process.exitCode;
		const output: string[] = [];
		const restoreStdout = captureStdout(output);

		try {
			process.exitCode = undefined;
			await runCli(
				[completionCommand.command],
				["node", "gitface", "completion", "invalid-topic", "--json-envelope"],
			);

			const payload = JSON.parse(output.join(""));
			expect(payload.status).toBe("error");
			expect(payload.code).toBe("COMPLETION_TOPIC_UNSUPPORTED");
			expect(payload.message).toBe("Completion topic must be: profiles.");
			expect(payload.data).toBeNull();
			expect(payload.errors).toEqual([
				{
					code: "COMPLETION_TOPIC_UNSUPPORTED",
					message: "Completion topic must be: profiles.",
				},
			]);
			expect(payload.meta.schemaVersion).toBe("1.0.0");
			expect(process.exitCode).toBe(1);
		} finally {
			process.exitCode = originalExitCode;
			restoreStdout();
		}
	});

	test("prints bash snippet with source-argument guards for profile commands", async () => {
		const output: string[] = [];
		const restoreStdout = captureStdout(output);

		try {
			await runCli(
				[completionCommand.command],
				["node", "gitface", "completion", "snippet", "--shell", "bash"],
			);

			const snippet = output.join("");
			expect(snippet).toContain("COMP_CWORD -eq 2");
			expect(snippet).toContain('"$sub" == "use"');
			expect(snippet).toContain('"$sub" == "rm"');
			expect(snippet).toContain('"$sub" == "remove"');
			expect(snippet).toContain('"$sub" == "edit"');
			expect(snippet).toContain('"$sub" == "clone"');
			expect(snippet).toContain('"$sub" == "rename"');
			expect(snippet).toContain('"$sub" == "mv"');
			expect(snippet).toContain("$COMP_CWORD -eq 4");
			expect(snippet).toContain('"$sub" == "rules"');
			expect(snippet).toContain('"$nested" == "add"');
			expect(snippet).toContain("--limit 50");
		} finally {
			restoreStdout();
		}
	});

	test("prints zsh snippet with source-argument guards for profile commands", async () => {
		const output: string[] = [];
		const restoreStdout = captureStdout(output);

		try {
			await runCli(
				[completionCommand.command],
				["node", "gitface", "completion", "snippet", "--shell", "zsh"],
			);

			const snippet = output.join("");
			expect(snippet).toContain("(( CURRENT == 3 )) || return 1");
			expect(snippet).toContain("(( CURRENT == 5 )) || return 1");
			expect(snippet).toContain("rm|remove|use|edit|clone|rename|mv");
			expect(snippet).toContain("rules) [[ $nested == add ]] && ok=1 ;;");
			expect(snippet).toContain(`compadd -- "\${names[@]}"`);
			expect(snippet).toContain("--limit 50");
		} finally {
			restoreStdout();
		}
	});
});
