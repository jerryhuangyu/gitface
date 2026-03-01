import { Command } from "commander";
import type { CliCommand } from "../command";
import action from "./action";

export const command: Command = new Command("use")
	.description("Apply a stored profile to the active Git configuration")
	.argument("[profile]", "profile identifier")
	.option("-s, --scope <scope>", "local (default), global, or system", "local")
	.option(
		"-q, --query <text>",
		"Filter profile names when profile arg is omitted",
	)
	.option("--dry-run", "Preview git config changes without writing")
	.option("--json", "Output machine-readable JSON")
	.option(
		"--json-envelope",
		"Output unified Result Envelope JSON with schema/version metadata",
	)
	.action(action);

const useProfileCommand: CliCommand = {
	command,
	action,
};

export default useProfileCommand;
