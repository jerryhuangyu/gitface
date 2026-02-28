import { Command } from "commander";
import type { CliCommand } from "../command";
import action from "./action";

const command = new Command("current")
	.description("Show the Git identity currently configured in this repository")
	.option(
		"--scope <scope>",
		"Read identity from one scope only (local, global, system)",
	)
	.option("--json", "Output current identity as JSON")
	.action(action);

const currentIdentityCommand: CliCommand = {
	command,
	action,
};

export default currentIdentityCommand;
