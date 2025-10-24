#!/usr/bin/env node

import { Command } from "commander";
import { git } from "./git";

const program = new Command();

program
	.name("gitface")
	.description("A simple CLI tool to change your “face” in Git")
	.version("0.0.1");

program
	.command("new")
	.description("Create a new git profile")
	.argument("<name>", "name of the git profile")
	.option("-f, --force", "overwrite if profile already exists")
	.action((name, options) => {
		const force = options.force || false;
		if (force) {
			console.log(`Forcing creation of profile: ${name}`);
		}
		console.log(`Creating profile: ${name}`);
	});

program
	.command("ls")
	.description("List all git profiles")
	.action(() => {
		console.log("Listing profiles...");
	});

/**
 * 顯示目前 git 設定
 */
program
	.command("current")
	.description("Show the current git profile")
	.action(async () => {
		const config = await git.listConfig();
		console.log("👤 Current Git config:");
		console.log("  user.name:", config.all["user.name"]);
		console.log("  user.email:", config.all["user.email"]);
	});

program
	.command("edit")
	.description("Edit a git profile")
	.argument("<name>", "name of the git profile")
	.action((name) => {
		console.log(`Editing profile: ${name}`);
	});

program
	.command("rm")
	.description("Remove a git profile")
	.argument("<name>", "name of the git profile")
	.action((name) => {
		console.log(`Removing profile: ${name}`);
	});

program
	.command("use")
	.description("Switch to a git profile")
	.argument("<name>", "name of the git profile")
	.action((name) => {
		console.log(`Switching to profile: ${name}`);
	});

program.parse();
