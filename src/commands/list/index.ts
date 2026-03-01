import { Command } from "commander";
import type { CliCommand } from "../command";
import action from "./action";

const command: Command = new Command("list")
	.alias("ls")
	.description("Display all stored Git profiles")
	.option("-q, --query <text>", "Filter profiles by name (case-insensitive)")
	.option("--sort <mode>", "Sort profiles by 'updated' (default) or 'name'")
	.option("--limit <number>", "Limit the number of returned profiles")
	.option("--json", "Output profiles as JSON")
	.option("--json-envelope", "Output profiles with a unified Result Envelope")
	.action(action);

const listProfilesCommand: CliCommand = {
	command,
	action,
};

export default listProfilesCommand;
