import { Command } from "commander";
import type { CliCommand } from "../command";
import { addRuleAction } from "./add";
import { listRulesAction } from "./list";
import { removeRuleAction } from "./remove";

const command = new Command("rules").description(
	"Manage folder-based profile rules",
);

command
	.command("list")
	.alias("ls")
	.description("List all folder rules")
	.option("--json", "Output folder rules as JSON")
	.action(listRulesAction);

command
	.command("add")
	.argument("<directory>", "Directory to apply the rule to")
	.argument("<profile>", "Profile to use for this directory")
	.description("Add a folder rule")
	.option("--json", "Output add result as JSON")
	.action(addRuleAction);

command
	.command("remove")
	.alias("rm")
	.argument("<directory>", "Directory to remove the rule for")
	.description("Remove a folder rule")
	.option("--json", "Output remove result as JSON")
	.action(removeRuleAction);

const rulesCommand: CliCommand = {
	command,
	action: () => command.help(),
};

export default rulesCommand;
