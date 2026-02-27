import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import simpleGit from "simple-git";
import { ProfileService } from "../src/core/profile-service";
import { newProfileCommand, rulesCommand } from "../src/commands/index";
import { runCli, safeRemove, spyConsole, stripAnsi } from "./helpers/e2e";

describe("rules command e2e", () => {
	test("adds a rule and applies profile to directory", async () => {
		const originalXdg = process.env.XDG_CONFIG_HOME;
		const originalHome = process.env.HOME;
		const originalArgv = process.argv.slice();
		const originalExitCode = process.exitCode;
		const originalCwd = process.cwd();
		const tmpRootRaw = await fs.mkdtemp(path.join(os.tmpdir(), "gitface-rules-"));
        const tmpRoot = await fs.realpath(tmpRootRaw);
		const homeDir = path.join(tmpRoot, "home");
		const configDir = path.join(tmpRoot, "config");
		const projectDir = path.join(homeDir, "project-a");
		const logs: string[] = [];
		// const restoreLog = spyConsole(logs);

		// Setup directories
		await fs.mkdir(homeDir, { recursive: true });
		await fs.mkdir(configDir, { recursive: true });
		await fs.mkdir(projectDir, { recursive: true });

		// Setup environment
		process.env.HOME = homeDir; // For global .gitconfig
		process.env.XDG_CONFIG_HOME = configDir; // For gitface profiles

		// Initialize global git config (needs to exist for simple-git sometimes?)
		// simple-git will read/write to ~/.gitconfig
		
		try {
			process.chdir(homeDir);

			// 1. Create a profile
			const service = ProfileService.create();
			await service.createProfile({
				name: "work-profile",
				gitName: "Work User",
				email: "work@example.com",
			});

			// 2. Add rule
			await runCli([newProfileCommand.command, rulesCommand.command], [
				"node",
				"gitface",
				"rules",
				"add",
				projectDir,
				"work-profile",
			]);

			// expect(stripAnsi(logs.join("\n"))).toMatch(/Rule added/i);
			logs.length = 0;

			// 3. Verify global config has includeIf
			const gitGlobal = simpleGit({ baseDir: homeDir }); 
			// simpleGit picks up global config from HOME env var
			const globalConfig = await gitGlobal.listConfig("global");

            // Note: simple-git listConfig keys are lowercased.
            // But verify we can find the includeIf key.
            // The key is complex: includeif.gitdir:/path/to/project-a/.path
            // We'll iterate to find it because exact key might vary slightly by git version normalization
            const configKeys = Object.keys(globalConfig.all);
            const includeIfKey = configKeys.find(k => k.toLowerCase().includes(projectDir.toLowerCase()));
            expect(includeIfKey).toBeDefined();

            // 4. Verify inside projectDir
            const gitProject = simpleGit({ baseDir: projectDir });
            await gitProject.init();
            const projectConfig = await gitProject.listConfig(); // Merges local, global, system
            
            expect(projectConfig.all["user.name"]).toBe("Work User");
            expect(projectConfig.all["user.email"]).toBe("work@example.com");

            // 5. Remove rule
            await runCli([rulesCommand.command], [
				"node",
				"gitface",
				"rules",
				"remove",
				projectDir,
			]);
            // expect(stripAnsi(logs.join("\n"))).toMatch(/Rule removed/i);

            // 6. Verify removal
            const globalConfigAfter = await gitGlobal.listConfig("global");
            const includeIfKeyAfter = Object.keys(globalConfigAfter.all).find(k => k.toLowerCase().includes(projectDir.toLowerCase()));
            expect(includeIfKeyAfter).toBeUndefined();

		} finally {
			process.chdir(originalCwd);
			process.argv = originalArgv;
			process.env.HOME = originalHome;
			
			if (originalXdg === undefined) {
				delete process.env.XDG_CONFIG_HOME;
			} else {
				process.env.XDG_CONFIG_HOME = originalXdg;
			}
			process.exitCode = originalExitCode;
			// restoreLog();
			await safeRemove(tmpRoot);
		}
	});
});
