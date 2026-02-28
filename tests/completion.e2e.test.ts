import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test, vi } from "vitest";
import { completionCommand } from "../src/commands/index";
import { runCli, safeRemove } from "./helpers/e2e";
import { ProfileService } from "../src/core/profile-service";

function captureStdout(buffer: string[]): () => void {
	const spy = vi
		.spyOn(process.stdout, "write")
		.mockImplementation(((chunk: string | Uint8Array) => {
			buffer.push(
				typeof chunk === "string"
					? chunk
					: Buffer.from(chunk).toString("utf8"),
			);
			return true;
		}) as typeof process.stdout.write);

	return () => spy.mockRestore();
}

describe("completion command e2e", () => {
	test("returns prefix-filtered profile names for profiles topic", async () => {
		const originalXdg = process.env.XDG_CONFIG_HOME;
		const originalExitCode = process.exitCode;
		const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gitface-completion-"));
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

			await runCli([completionCommand.command], [
				"node",
				"gitface",
				"completion",
				"profiles",
				"--prefix",
				"wo",
			]);

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

	test("limits returned profile names with --limit", async () => {
		const originalXdg = process.env.XDG_CONFIG_HOME;
		const originalExitCode = process.exitCode;
		const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gitface-completion-"));
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

			await runCli([completionCommand.command], [
				"node",
				"gitface",
				"completion",
				"profiles",
				"--prefix",
				"al",
				"--limit",
				"2",
			]);

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

	test("sets exit code and writes no output for invalid --limit", async () => {
		const originalXdg = process.env.XDG_CONFIG_HOME;
		const originalExitCode = process.exitCode;
		const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gitface-completion-"));
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

			await runCli([completionCommand.command], [
				"node",
				"gitface",
				"completion",
				"profiles",
				"--prefix",
				"wo",
				"--limit",
				"0",
			]);

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

	test("returns filtered profile names even when unrelated profile JSON is malformed", async () => {
		const originalXdg = process.env.XDG_CONFIG_HOME;
		const originalExitCode = process.exitCode;
		const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gitface-completion-"));
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
			await fs.writeFile(path.join(profilesDir, "oops.json"), "{not-valid-json");

			await runCli([completionCommand.command], [
				"node",
				"gitface",
				"completion",
				"profiles",
				"--prefix",
				"wo",
			]);

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
			await runCli([completionCommand.command], [
				"node",
				"gitface",
				"completion",
				"invalid-topic",
			]);

			expect(process.exitCode).toBe(1);
			expect(output.join("")).toBe("");
		} finally {
			process.exitCode = originalExitCode;
			restoreStdout();
		}
	});

	test("prints bash snippet with source-argument guards for profile commands", async () => {
		const output: string[] = [];
		const restoreStdout = captureStdout(output);

		try {
			await runCli([completionCommand.command], [
				"node",
				"gitface",
				"completion",
				"snippet",
				"--shell",
				"bash",
			]);

			const snippet = output.join("");
			expect(snippet).toContain("COMP_CWORD -eq 2");
			expect(snippet).toContain('"$sub" == "use"');
			expect(snippet).toContain('"$sub" == "rm"');
			expect(snippet).toContain('"$sub" == "remove"');
			expect(snippet).toContain('"$sub" == "edit"');
			expect(snippet).toContain('"$sub" == "clone"');
			expect(snippet).toContain('"$sub" == "rename"');
			expect(snippet).toContain('"$sub" == "mv"');
			expect(snippet).toContain('$COMP_CWORD -eq 4');
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
			await runCli([completionCommand.command], [
				"node",
				"gitface",
				"completion",
				"snippet",
				"--shell",
				"zsh",
			]);

			const snippet = output.join("");
			expect(snippet).toContain("(( CURRENT == 3 )) || return 1");
			expect(snippet).toContain("(( CURRENT == 5 )) || return 1");
			expect(snippet).toContain("rm|remove|use|edit|clone|rename|mv");
			expect(snippet).toContain("rules) [[ $nested == add ]] && ok=1 ;;");
			expect(snippet).toContain('compadd -- "${names[@]}"');
			expect(snippet).toContain("--limit 50");
		} finally {
			restoreStdout();
		}
	});
});
