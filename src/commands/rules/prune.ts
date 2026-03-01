import fs from "node:fs/promises";
import process from "node:process";
import { ProfileService } from "@/core/profile-service";
import { type FolderRule, RuleService } from "@/core/rule-service";
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
	includeMissingDirectory?: boolean;
	strict?: boolean;
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

async function directoryExists(directory: string): Promise<boolean> {
	try {
		const stats = await fs.stat(directory);
		return stats.isDirectory();
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return false;
		}
		throw error;
	}
}

async function scanPrunableRules(
	rules: FolderRule[],
	options: RulePruneOptions,
): Promise<RulePruneResult[]> {
	const profileService = ProfileService.create();
	const profileExistsCache = new Map<string, Promise<boolean>>();

	const results: RulePruneResult[] = [];
	for (const rule of rules) {
		let hasProfilePromise = profileExistsCache.get(rule.profileName);
		if (!hasProfilePromise) {
			hasProfilePromise = profileExists(profileService, rule.profileName);
			profileExistsCache.set(rule.profileName, hasProfilePromise);
		}

		const hasProfile = await hasProfilePromise;
		if (!options.includeMissingDirectory) {
			if (!hasProfile) {
				results.push({
					directory: rule.directory,
					profileName: rule.profileName,
					profileExists: false,
					status: "candidate",
				});
			}
			continue;
		}

		const hasDirectory = await directoryExists(rule.directory);
		if (!hasProfile || !hasDirectory) {
			const staleReason =
				!hasProfile && !hasDirectory
					? "missing-profile-and-directory"
					: !hasProfile
						? "missing-profile"
						: "missing-directory";
			results.push({
				directory: rule.directory,
				profileName: rule.profileName,
				profileExists: hasProfile,
				directoryExists: hasDirectory,
				staleReason,
				status: "candidate",
			});
		}
	}

	return results;
}

async function buildDryRunReportWithOptions(
	options: RulePruneOptions,
): Promise<RulePruneReport> {
	const ruleService = RuleService.create();
	const scannedRules = await ruleService.listRules().catch((error) => {
		if (isMissingGlobalConfigError(error)) {
			return [];
		}
		throw error;
	});
	const results = await scanPrunableRules(scannedRules, options);
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
): Promise<RulePruneReport> {
	const ruleService = RuleService.create();
	const scannedRules = await ruleService.listRules().catch((error) => {
		if (isMissingGlobalConfigError(error)) {
			return [];
		}
		throw error;
	});
	const candidates = await scanPrunableRules(scannedRules, options);

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
				? await buildDryRunReportWithOptions(options)
				: await buildApplyReport(options);
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
