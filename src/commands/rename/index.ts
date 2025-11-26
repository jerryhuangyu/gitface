import { Command } from "commander";
import type { CliCommand } from "../command";
import action from "./action";

const command: Command = new Command("rename")
	.alias("mv")
	.description("Rename an existing profile")
	.argument("<old-name>", "current profile identifier")
	.argument("<new-name>", "new profile identifier")
	.option("-f, --force", "Overwrite target profile if it exists")
	.action(action);

const renameProfileCommand: CliCommand = {
	command,
	action,
};

export default renameProfileCommand;
