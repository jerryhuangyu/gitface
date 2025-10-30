import { Command } from "commander";
import type { CliCommand } from "../command";
import action from "./action";

const command: Command = new Command("rm")
	.alias("remove")
	.description("Delete a stored Git profile")
	.argument("<profile>", "profile identifier")
	.option("-f, --force", "Ignore missing profile errors")
	.action(action);

const removeProfileCommand: CliCommand = {
	command,
	action,
};

export default removeProfileCommand;
