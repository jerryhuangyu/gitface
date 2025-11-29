import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import { describe, expect, test } from "vitest";
import React from "react";
import { render } from "ink";
import { listProfilesCommand } from "../src/commands/index";
import { ProfileService } from "../src/core/profile-service";
import { runCli, safeRemove } from "./helpers/e2e";

describe("list command e2e", () => {
	test(
		"renders profiles list via CLI",
		async () => {
		const originalXdg = process.env.XDG_CONFIG_HOME;
		const originalArgv = process.argv.slice();
		const originalExitCode = process.exitCode;
		const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gitface-cli-"));
			const configDir = path.join(tmpRoot, "config");

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

			await runCli([listProfilesCommand.command], [
				"node",
				"gitface",
				"list",
			]);

			// Render the list component with Ink to capture real output (including table)
			const capture = createWritableCapture();
			const ListUi = (await import("../src/commands/list/ui")).default;
			const ui = React.createElement(ListUi, {
				profiles: await service.listProfiles(),
			});
			const instance = render(ui, {
				stdout: capture.stream,
				stderr: capture.stream,
				patchConsole: false,
				exitOnCtrlC: false,
			});

			// Allow render to flush, then unmount to avoid hanging
			await new Promise((resolve) => setTimeout(resolve, 50));
			instance.unmount();

			const output = capture.chunks.join("");
			expect(output).toContain("work");
			expect(output).toContain("personal");
		} finally {
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

function createWritableCapture(): {
	chunks: string[];
	stream: NodeJS.WriteStream;
} {
	const chunks: string[] = [];
	const pass = new PassThrough();
	pass.on("data", (chunk) => chunks.push(chunk.toString()));

	const stream = Object.assign(pass, {
		isTTY: false,
		columns: 80,
		rows: 24,
		getColorDepth: () => 1,
		hasColors: () => false,
		cursorTo: () => true,
		moveCursor: () => true,
		clearLine: () => true,
		clearScreenDown: () => true,
	}) as unknown as NodeJS.WriteStream;

	return { chunks, stream };
}
