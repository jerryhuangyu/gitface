import { Command } from "commander";
import type { CliCommand } from "../command";
import { addRuleAction } from "./add";
import { applyRuleAction } from "./apply";
import doctorRuleAction from "./doctor";
import { listRulesAction } from "./list";
import { removeRuleAction } from "./remove";
import { resolveRuleAction } from "./resolve";

const command = new Command("rules").description(
	"Manage folder-based profile rules",
);

command
	.command("apply")
	.argument(
		"[directory]",
		"Directory to resolve and apply (defaults to current working directory)",
	)
	.description("Resolve matched folder rule and apply profile")
	.option("-s, --scope <scope>", "local (default), global, or system", "local")
	.option(
		"--fallback-profile <profile>",
		"Apply this profile when no folder rule matches the target directory",
	)
	.option(
		"--dry-run",
		"Preview profile application without changing git config",
	)
	.option(
		"--strict",
		"Treat unmatched rules as failures (exit code 1) for CI gating",
	)
	.option("--json", "Output apply result as JSON")
	.action(applyRuleAction);

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
	.option(
		"--strict",
		"Treat unmatched or missing-profile matches as failures (exit code 1)",
	)
	.option("--json", "Output resolve result as JSON")
	.action(resolveRuleAction);

command
	.command("doctor")
	.description("Check folder rule health (profile/directory integrity)")
	.option("--strict", "Treat warnings as failures (exit code 1) for CI gating")
	.option("--json", "Output doctor report as JSON")
	.action(doctorRuleAction);

const rulesCommand: CliCommand = {
	command,
	action: () => command.help(),
};

export default rulesCommand;
