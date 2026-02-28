import { Command } from "commander";
import type { CliCommand } from "../command";
import { addRuleAction } from "./add";
import { listRulesAction } from "./list";
import { removeRuleAction } from "./remove";
import { resolveRuleAction } from "./resolve";

const command = new Command("rules").description(
	"Manage folder-based profile rules",
);

command
	.command("list")
	.alias("ls")
	.description("List all folder rules")
	.option(
		"-q, --query <text>",
		"Filter rules by directory/profile (case-insensitive)",
	)
	.option("--limit <number>", "Limit number of listed rules")
	.option("--json", "Output folder rules as JSON")
	.action(listRulesAction);

command
	.command("add")
	.argument("<directory>", "Directory to apply the rule to")
	.argument("<profile>", "Profile to use for this directory")
	.description("Add a folder rule")
	.option("--dry-run", "Preview rule addition without changing git config")
	.option("--json", "Output add result as JSON")
	.action(addRuleAction);

command
	.command("remove")
	.alias("rm")
	.argument("<directory>", "Directory to remove the rule for")
	.description("Remove a folder rule")
	.option("--dry-run", "Preview rule removal without changing git config")
	.option("--json", "Output remove result as JSON")
	.action(removeRuleAction);

command
	.command("resolve")
	.argument(
		"[directory]",
		"Directory to resolve (defaults to current working directory)",
	)
	.description("Resolve the effective folder rule for a directory")
	.option("--json", "Output resolve result as JSON")
	.action(resolveRuleAction);

const rulesCommand: CliCommand = {
	command,
	action: () => command.help(),
};

export default rulesCommand;
