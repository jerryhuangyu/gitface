import { Command } from "commander";
import type { CliCommand } from "../command";
import action from "./action";

const command: Command = new Command("export")
	.description("Export all profiles to JSON")
	.argument("[file]", "output file path (defaults to stdout)")
	.option("--json", "Output machine-readable export result")
	.action(action);

const exportProfileCommand: CliCommand = {
	command,
	action,
};

export default exportProfileCommand;
