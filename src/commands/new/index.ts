import { Command } from "commander";
import type { CliCommand } from "../command";
import action from "./action";

const command: Command = new Command("new")
	.description("Create a profile from the current Git config or passed options")
	.argument("<profile>", "profile identifier")
	.option("-n, --git-name <value>", "Git user.name value to store")
	.option("-e, --email <value>", "Git user.email value to store")
	.option("-s, --signing-key <value>", "Git signing key value to store")
	.option("-f, --force", "Overwrite an existing profile")
	.action(action);

const newProfileCommand: CliCommand = {
	command,
	action,
};

export default newProfileCommand;
