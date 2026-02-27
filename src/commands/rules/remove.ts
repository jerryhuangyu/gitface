import chalk from "chalk";
import { RuleService } from "@/core/rule-service";
import { logger } from "@/infra/logger";

export async function removeRuleAction(directory: string): Promise<void> {
	const ruleService = RuleService.create();
	try {
		// We could verify if it exists first, or just try to remove it.
		// removeRule implementation does not throw if missing, it's idempotent-ish (unset-all).
		await ruleService.removeRule(directory);
		console.log(
			chalk.green(`Rule removed for directory: ${chalk.cyan(directory)}`),
		);
	} catch (error) {
		logger.error("Failed to remove rule", { error });
		console.error(chalk.red("Failed to remove rule:"), error);
		process.exit(1);
	}
}
