import { RuleService } from "@/core/rule-service";
import { logger } from "@/infra/logger";
import chalk from "chalk";
import { ProfileNotFoundError } from "@/errors";

export async function addRuleAction(
	directory: string,
	profileName: string,
): Promise<void> {
	const ruleService = RuleService.create();
	try {
		await ruleService.addRule(directory, profileName);
		console.log(
			chalk.green(
				`Rule added: ${chalk.cyan(directory)} matches profile ${chalk.bold(profileName)}`,
			),
		);
	} catch (error) {
		if (error instanceof ProfileNotFoundError) {
            console.error(chalk.red(`Profile '${profileName}' not found.`));
            process.exit(1);
        }
        
		logger.error("Failed to add rule", { error });
		console.error(chalk.red("Failed to add rule:"), error);
		process.exit(1);
	}
}
