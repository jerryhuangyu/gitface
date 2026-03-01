import process from "node:process";
import { ProfileService } from "@/core/profile-service";
import { RuleService } from "@/core/rule-service";
import { InvalidProfileError } from "@/errors";
import { withCommandHandling } from "../command-runner";
import {
	type RulePruneReport,
	type RulePruneResult,
	sendRulePruneFailedJson,
	sendRulePruneFailedMsg,
	sendRulePruneReportJson,
	sendRulePruneReportMsg,
} from "./ui";

interface RulePruneOptions {
	dryRun?: boolean;
	json?: boolean;
}

const isMissingGlobalConfigError = (error: unknown): boolean => {
	return (
		error instanceof Error &&
		error.message.toLowerCase().includes("unable to read config file")
	);
};

async function profileExists(
	service: ProfileService,
	profileName: string,
): Promise<boolean> {
	try {
		return (await service.findProfile(profileName)) !== null;
	} catch (error) {
		if (error instanceof InvalidProfileError) {
			return false;
		}
		throw error;
	}
}

async function scanPrunableRules(): Promise<RulePruneResult[]> {
	const ruleService = RuleService.create();
	const profileService = ProfileService.create();
	const rules = await ruleService.listRules().catch((error) => {
		if (isMissingGlobalConfigError(error)) {
			return [];
		}
		throw error;
	});

	const results: RulePruneResult[] = [];
	for (const rule of rules) {
		const hasProfile = await profileExists(profileService, rule.profileName);
		if (!hasProfile) {
			results.push({
				directory: rule.directory,
				profileName: rule.profileName,
				profileExists: false,
				status: "candidate",
			});
		}
	}

	return results;
}

async function buildDryRunReport(): Promise<RulePruneReport> {
	const ruleService = RuleService.create();
	const scanned = await ruleService.listRules().catch((error) => {
		if (isMissingGlobalConfigError(error)) {
			return [];
		}
		throw error;
	});
	const results = await scanPrunableRules();
	return {
		status: "dry-run",
		dryRun: true,
		summary: {
			scanned: scanned.length,
			prunable: results.length,
			pruned: 0,
			skipped: 0,
		},
		results,
	};
}

async function buildApplyReport(): Promise<RulePruneReport> {
	const ruleService = RuleService.create();
	const scannedRules = await ruleService.listRules().catch((error) => {
		if (isMissingGlobalConfigError(error)) {
			return [];
		}
		throw error;
	});
	const candidates = await scanPrunableRules();

	const results: RulePruneResult[] = [];
	let pruned = 0;
	let skipped = 0;

	for (const candidate of candidates) {
		try {
			await ruleService.removeRule(candidate.directory);
			results.push({
				...candidate,
				status: "pruned",
			});
			pruned += 1;
		} catch (error) {
			const reason = error instanceof Error ? error.message : String(error);
			results.push({
				...candidate,
				status: "skipped",
				reason,
			});
			skipped += 1;
		}
	}

	return {
		status: skipped > 0 ? "partial" : "pruned",
		dryRun: false,
		summary: {
			scanned: scannedRules.length,
			prunable: candidates.length,
			pruned,
			skipped,
		},
		results,
	};
}

export const pruneRuleAction: (options: RulePruneOptions) => Promise<void> =
	withCommandHandling("command:rules:prune", async (options) => {
		try {
			const report = options.dryRun
				? await buildDryRunReport()
				: await buildApplyReport();
			if (options.json) {
				sendRulePruneReportJson(report);
			} else {
				sendRulePruneReportMsg(report);
			}

			if (!options.dryRun && report.summary.skipped > 0) {
				process.exitCode = 1;
			}
		} catch (error) {
			const reason =
				error instanceof Error
					? error.message
					: `Unexpected error ${JSON.stringify(error)}`;
			if (options.json) {
				sendRulePruneFailedJson(reason);
			} else {
				sendRulePruneFailedMsg(`Failed to prune rules: ${reason}`);
			}
			process.exitCode = 1;
		}
	});
