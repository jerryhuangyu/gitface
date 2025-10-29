import { Command } from "commander";
import type { CliCommand } from "../command";
import action from "./action";

const command: Command = new Command("list")
	.alias("ls")
	.description("Display all stored Git profiles")
	.action(action);

const listProfilesCommand: CliCommand = {
	command,
	action,
};

export default listProfilesCommand;
