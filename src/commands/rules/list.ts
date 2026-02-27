import { RuleService } from "@/core/rule-service";
import { logger } from "@/infra/logger";
import chalk from "chalk";

export async function listRulesAction(): Promise<void> {
	const ruleService = RuleService.create();
	try {
		const rules = await ruleService.listRules();
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
