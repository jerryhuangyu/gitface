import chalk from "chalk";
import { RuleService } from "@/core/rule-service";
import { logger } from "@/infra/logger";

interface ListRulesOptions {
	json?: boolean;
}

export async function listRulesAction(
	options: ListRulesOptions,
): Promise<void> {
	const ruleService = RuleService.create();
	try {
		const rules = await ruleService.listRules();
		if (options.json) {
			console.log(JSON.stringify(rules, null, 2));
			return;
		}

		if (rules.length === 0) {
			console.log(chalk.gray("No folder rules defined."));
			return;
		}

		console.log(chalk.bold("Folder Rules:"));
		for (const rule of rules) {
			console.log(
				`  ${chalk.cyan(rule.directory)} ${chalk.gray("->")} ${chalk.green(rule.profileName)}`,
			);
		}
	} catch (error) {
		logger.error("Failed to list rules", { error });
		console.error(chalk.red("Failed to list rules:"), error);
		process.exit(1);
	}
}
