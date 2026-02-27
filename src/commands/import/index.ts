import { Command } from "commander";
import type { CliCommand } from "../command";
import action from "./action";

const command: Command = new Command("import")
	.description("Import profiles from a JSON file")
	.argument("<file>", "input file path")
	.option("--overwrite", "Overwrite existing profiles")
	.option("--dry-run", "Validate import without writing profiles")
	.option("--json", "Output machine-readable import results")
	.action(action);

const importProfileCommand: CliCommand = {
	command,
	action,
};

export default importProfileCommand;
