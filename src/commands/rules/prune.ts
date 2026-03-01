import process from "node:process";
import { type FolderRule, RuleService } from "@/core/rule-service";
import { withCommandHandling } from "../command-runner";
import { parseConcurrency, scanRuleIntegrity } from "./integrity";
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
	includeMissingDirectory?: boolean;
	strict?: boolean;
	concurrency?: string;
}

const isMissingGlobalConfigError = (error: unknown): boolean => {
	return (
		error instanceof Error &&
		error.message.toLowerCase().includes("unable to read config file")
	);
};

async function scanPrunableRules(
	rules: FolderRule[],
	options: RulePruneOptions,
	concurrency: number,
): Promise<RulePruneResult[]> {
	const includeMissingDirectory = options.includeMissingDirectory ?? false;
	const integrityResults = await scanRuleIntegrity(rules, {
		checkDirectory: includeMissingDirectory,
		concurrency,
	});

	const candidates: RulePruneResult[] = [];
	for (const result of integrityResults) {
		if (!includeMissingDirectory) {
			if (!result.profileExists) {
				candidates.push({
					directory: result.directory,
					profileName: result.profileName,
					profileExists: false,
					status: "candidate",
				});
			}
			continue;
		}

		if (result.profileExists && result.directoryExists) {
			continue;
		}
		const staleReason =
			!result.profileExists && !result.directoryExists
				? "missing-profile-and-directory"
				: !result.profileExists
					? "missing-profile"
					: "missing-directory";
		candidates.push({
			directory: result.directory,
			profileName: result.profileName,
			profileExists: result.profileExists,
			directoryExists: result.directoryExists,
			staleReason,
			status: "candidate",
		});
	}

	return candidates;
}

async function buildDryRunReportWithOptions(
	options: RulePruneOptions,
	concurrency: number,
): Promise<RulePruneReport> {
	const ruleService = RuleService.create();
	const scannedRules = await ruleService.listRules().catch((error) => {
		if (isMissingGlobalConfigError(error)) {
			return [];
		}
		throw error;
	});
	const results = await scanPrunableRules(scannedRules, options, concurrency);
	return {
		status: "dry-run",
		dryRun: true,
		summary: {
			scanned: scannedRules.length,
			prunable: results.length,
			pruned: 0,
			skipped: 0,
		},
		results,
	};
}

async function buildApplyReport(
	options: RulePruneOptions,
	concurrency: number,
): Promise<RulePruneReport> {
	const ruleService = RuleService.create();
	const scannedRules = await ruleService.listRules().catch((error) => {
		if (isMissingGlobalConfigError(error)) {
			return [];
		}
		throw error;
	});
	const candidates = await scanPrunableRules(
		scannedRules,
		options,
		concurrency,
	);

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
			const concurrency = parseConcurrency(options.concurrency);
			const report = options.dryRun
				? await buildDryRunReportWithOptions(options, concurrency)
				: await buildApplyReport(options, concurrency);
			if (options.json) {
				sendRulePruneReportJson(report, options.strict ?? false);
			} else {
				sendRulePruneReportMsg(report, options.strict ?? false);
			}

			if (
				(options.dryRun && options.strict && report.summary.prunable > 0) ||
				(!options.dryRun && report.summary.skipped > 0)
			) {
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
