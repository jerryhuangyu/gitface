import chalk from "chalk";
import { RuleService } from "@/core/rule-service";
import { logger } from "@/infra/logger";

interface ListRulesOptions {
	json?: boolean;
	query?: string;
	limit?: string;
}

interface RuleSnapshot {
	directory: string;
	profileName: string;
}

const sortRulesByDirectoryAsc = (rules: RuleSnapshot[]): RuleSnapshot[] => {
	return [...rules].sort((a, b) => a.directory.localeCompare(b.directory));
};

const filterRulesByQuery = (
	rules: RuleSnapshot[],
	query: string | undefined,
): RuleSnapshot[] => {
	const normalized = query?.trim().toLowerCase();
	if (!normalized) {
		return rules;
	}

	return rules.filter(
		(rule) =>
			rule.directory.toLowerCase().includes(normalized) ||
			rule.profileName.toLowerCase().includes(normalized),
	);
};

const parseLimit = (value: string | undefined): number | undefined => {
	if (value === undefined) {
		return undefined;
	}

	const normalized = value.trim();
	if (!/^\d+$/.test(normalized)) {
		throw new Error("Limit must be a positive integer.");
	}

	const limit = Number.parseInt(normalized, 10);
	if (limit < 1) {
		throw new Error("Limit must be a positive integer.");
	}

	return limit;
};

const applyLimit = (
	rules: RuleSnapshot[],
	limit: number | undefined,
): RuleSnapshot[] => {
	if (limit === undefined) {
		return rules;
	}
	return rules.slice(0, limit);
};

export async function listRulesAction(
	options: ListRulesOptions,
): Promise<void> {
	const ruleService = RuleService.create();
	try {
		const limit = parseLimit(options.limit);
		const rules = applyLimit(
			filterRulesByQuery(
				sortRulesByDirectoryAsc(await ruleService.listRules()),
				options.query,
			),
			limit,
		);
		if (options.json) {
			console.log(JSON.stringify(rules, null, 2));
			return;
		}

		if (rules.length === 0) {
			if (options.query?.trim()) {
				console.log(
					chalk.gray(`No folder rules matched "${options.query.trim()}".`),
				);
				return;
			}
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
		const message = error instanceof Error ? error.message : String(error);
		console.error(chalk.red("Failed to list rules:"), message);
		process.exitCode = 1;
	}
}
