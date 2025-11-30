import { Command } from "commander";
import type { CliCommand } from "../command";
import action from "./action";
import snippetAction from "./snippet";

const command: Command = new Command("completion")
	.description("Internal helper to provide shell completions")
	.argument("<topic>", "completion topic (profiles|rm|remove)")
	.option("-p, --prefix <prefix>", "filter suggestions by prefix")
	.option(
		"-d, --delimiter <delimiter>",
		"delimiter between suggestions (default: newline)",
	)
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
