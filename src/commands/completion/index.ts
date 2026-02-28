import { Command } from "commander";
import type { CliCommand } from "../command";
import action from "./action";
import snippetAction from "./snippet";

const command: Command = new Command("completion")
	.description("Internal helper to provide shell completions")
	.argument("<topic>", "completion topic (profiles)")
	.option("-p, --prefix <prefix>", "filter suggestions by prefix")
	.option(
		"-l, --limit <number>",
		"limit returned suggestions to a positive integer",
	)
	.option(
		"-d, --delimiter <delimiter>",
		"delimiter between suggestions (default: newline)",
	)
	.option("--json", "emit machine-readable JSON output")
	.action(action);

command
	.command("snippet")
	.description("Print a shell completion snippet (bash|zsh)")
	.requiredOption("-s, --shell <shell>", "target shell (bash|zsh)")
	.action((options) => snippetAction(options));

const completionCommand: CliCommand = {
	command,
	action,
};

export default completionCommand;
