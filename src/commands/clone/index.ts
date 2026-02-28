import { Command } from "commander";
import type { CliCommand } from "../command";
import action from "./action";

const command: Command = new Command("clone")
	.description("Clone an existing profile to a new name")
	.argument("<source>", "source profile identifier")
	.argument("<target>", "target profile identifier")
	.option("-f, --force", "Overwrite target profile if it exists")
	.option("--json", "Output result as JSON")
	.action(action);

const cloneProfileCommand: CliCommand = {
	command,
	action,
};

export default cloneProfileCommand;
