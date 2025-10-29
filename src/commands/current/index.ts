import { Command } from "commander";
import type { CliCommand } from "../command";
import action from "./action";

const command = new Command("current")
	.description("Show the Git identity currently configured in this repository")
	.action(action);

const currentIdentityCommand: CliCommand = {
	command,
	action,
};

export default currentIdentityCommand;
