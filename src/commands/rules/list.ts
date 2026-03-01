import chalk from "chalk";
import { RuleService } from "@/core/rule-service";
import { logger } from "@/infra/logger";
import {
	parseConcurrency,
	type RuleIntegrityScanMetrics,
	scanRuleIntegrity,
} from "./integrity";

interface ListRulesOptions {
	json?: boolean;
	query?: string;
	limit?: string;
	health?: boolean;
	concurrency?: string;
}

interface RuleSnapshot {
	directory: string;
	profileName: string;
}

interface RuleHealthSnapshot extends RuleSnapshot {
	status: "pass" | "warn" | "fail";
	profileExists: boolean;
	directoryExists: boolean;
}

interface RuleHealthSummary {
	total: number;
	pass: number;
	warn: number;
	fail: number;
}

interface RuleHealthReport {
	rules: RuleHealthSnapshot[];
	summary: RuleHealthSummary;
	metrics: RuleIntegrityScanMetrics;
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

const buildEmptyMetrics = (concurrency: number): RuleIntegrityScanMetrics => ({
	concurrency,
	scanned: 0,
	uniqueProfilesChecked: 0,
	uniqueDirectoriesChecked: 0,
	scanDurationMs: 0,
});

const isMissingGlobalConfigError = (error: unknown): boolean => {
	return (
		error instanceof Error &&
		error.message.toLowerCase().includes("unable to read config file")
	);
};

const toRuleStatus = (
	rule: Pick<RuleHealthSnapshot, "profileExists" | "directoryExists">,
): RuleHealthSnapshot["status"] => {
	if (!rule.profileExists) {
		return "fail";
	}
	if (!rule.directoryExists) {
		return "warn";
	}
	return "pass";
};

const summarizeRuleHealth = (
	rules: RuleHealthSnapshot[],
): RuleHealthSummary => {
	return rules.reduce(
		(acc, item) => {
			acc[item.status] += 1;
			return acc;
		},
		{
			total: rules.length,
			pass: 0,
			warn: 0,
			fail: 0,
		},
	);
};

const buildHealthReport = async (
	rules: RuleSnapshot[],
	concurrency: number,
): Promise<RuleHealthReport> => {
	if (rules.length === 0) {
		return {
			rules: [],
			summary: {
				total: 0,
				pass: 0,
				warn: 0,
				fail: 0,
			},
			metrics: buildEmptyMetrics(concurrency),
		};
	}

	const integrityReport = await scanRuleIntegrity(rules, {
		checkDirectory: true,
		concurrency,
	});
	const ruleHealth = integrityReport.records.map((record) => ({
		...record,
		status: toRuleStatus(record),
	}));

	return {
		rules: ruleHealth,
		summary: summarizeRuleHealth(ruleHealth),
		metrics: integrityReport.metrics,
	};
};

const formatRuleStatus = (status: RuleHealthSnapshot["status"]): string => {
	if (status === "pass") {
		return chalk.green("PASS");
	}
	if (status === "warn") {
		return chalk.yellow("WARN");
	}
	return chalk.red("FAIL");
};

const formatRuleStatusReason = (rule: RuleHealthSnapshot): string => {
	if (!rule.profileExists && !rule.directoryExists) {
		return "missing profile + missing directory";
	}
	if (!rule.profileExists) {
		return "missing profile";
	}
	if (!rule.directoryExists) {
		return "missing directory";
	}
	return "ok";
};

export async function listRulesAction(
	options: ListRulesOptions,
): Promise<void> {
	const ruleService = RuleService.create();
	try {
		if (options.concurrency !== undefined && !options.health) {
			throw new Error("--concurrency requires --health.");
		}
		const limit = parseLimit(options.limit);
		const listedRules = await ruleService.listRules().catch((error) => {
			if (isMissingGlobalConfigError(error)) {
				return [];
			}
			throw error;
		});
		const rules = applyLimit(
			filterRulesByQuery(sortRulesByDirectoryAsc(listedRules), options.query),
			limit,
		);
		if (options.health) {
			const concurrency = parseConcurrency(options.concurrency);
			const report = await buildHealthReport(rules, concurrency);

			if (options.json) {
				console.log(JSON.stringify(report, null, 2));
				return;
			}

			if (report.rules.length === 0) {
				if (options.query?.trim()) {
					console.log(
						chalk.gray(`No folder rules matched "${options.query.trim()}".`),
					);
					return;
				}
				console.log(chalk.gray("No folder rules defined."));
				return;
			}

			console.log(chalk.bold("Folder Rules (Health):"));
			for (const rule of report.rules) {
				console.log(
					`  [${formatRuleStatus(rule.status)}] ${chalk.cyan(rule.directory)} ${chalk.gray("->")} ${chalk.green(rule.profileName)} ${chalk.gray(`(${formatRuleStatusReason(rule)})`)}`,
				);
			}
			console.log(
				chalk.bold(
					`Summary: total=${report.summary.total}, pass=${report.summary.pass}, warn=${report.summary.warn}, fail=${report.summary.fail}`,
				),
			);
			console.log(
				chalk.gray(
					`Scan Metrics: concurrency=${report.metrics.concurrency}, scanned=${report.metrics.scanned}, uniqueProfiles=${report.metrics.uniqueProfilesChecked}, uniqueDirectories=${report.metrics.uniqueDirectoriesChecked}, durationMs=${report.metrics.scanDurationMs}`,
				),
			);
			return;
		}

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
