import { Command } from "commander";
import type { CliCommand } from "../command";
import action from "./action";

const command: Command = new Command("import")
	.description("Import profiles from a JSON file")
	.argument("<file>", "input file path")
	.option("--overwrite", "Overwrite existing profiles")
	.option(
		"--atomic",
		"Validate all entries first; abort the whole import if any entry fails",
	)
	.option("--dry-run", "Validate import without writing profiles")
	.option(
		"--strict",
		"Exit with non-zero status when any profile fails to import/validate",
	)
	.option("--json", "Output machine-readable import results")
	.option(
		"--json-envelope",
		"Output import results with unified Result Envelope",
	)
	.action(action);

const importProfileCommand: CliCommand = {
	command,
	action,
};

export default importProfileCommand;
