import fs from "node:fs/promises";
import process from "node:process";
import { ProfileService } from "@/core/profile-service";
import { RuleService } from "@/core/rule-service";
import { InvalidProfileError } from "@/errors";
import { withCommandHandling } from "../command-runner";
import {
	type RuleDoctorReport,
	type RuleDoctorResult,
	sendRuleDoctorFailedJson,
	sendRuleDoctorFailedMsg,
	sendRuleDoctorReportJson,
	sendRuleDoctorReportMsg,
} from "./ui";

interface RuleDoctorOptions {
	json?: boolean;
	strict?: boolean;
}

const isMissingGlobalConfigError = (error: unknown): boolean => {
	return (
		error instanceof Error &&
		error.message.toLowerCase().includes("unable to read config file")
	);
};

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

async function buildDoctorReport(): Promise<RuleDoctorReport> {
	const ruleService = RuleService.create();
	const profileService = ProfileService.create();
	const rules = await ruleService.listRules().catch((error) => {
		if (isMissingGlobalConfigError(error)) {
			return [];
		}
		throw error;
	});

	const results: RuleDoctorResult[] = [];
	for (const rule of rules) {
		const [hasProfile, hasDirectory] = await Promise.all([
			profileExists(profileService, rule.profileName),
			directoryExists(rule.directory),
		]);
		const status = !hasProfile ? "fail" : hasDirectory ? "pass" : "warn";
		results.push({
			directory: rule.directory,
			profileName: rule.profileName,
			status,
			profileExists: hasProfile,
			directoryExists: hasDirectory,
		});
	}

	const summary = results.reduce(
		(acc, item) => {
			acc[item.status] += 1;
			return acc;
		},
		{
			total: results.length,
			pass: 0,
			warn: 0,
			fail: 0,
		},
	);

	return {
		status: summary.warn > 0 || summary.fail > 0 ? "issues" : "ok",
		summary,
		results,
	};
}

const doctorRuleAction: (options: RuleDoctorOptions) => Promise<void> =
	withCommandHandling("command:rules:doctor", async (options) => {
		const strictMode = options.strict ?? false;

		try {
			const report = await buildDoctorReport();
			if (options.json) {
				sendRuleDoctorReportJson(report, strictMode);
			} else {
				sendRuleDoctorReportMsg(report, strictMode);
			}

			const hasFailures = report.summary.fail > 0;
			const hasWarnings = report.summary.warn > 0;
			if (hasFailures || (strictMode && hasWarnings)) {
				process.exitCode = 1;
			}
		} catch (error) {
			const reason =
				error instanceof Error
					? error.message
					: `Unexpected error ${JSON.stringify(error)}`;
			if (options.json) {
				sendRuleDoctorFailedJson(reason);
			} else {
				sendRuleDoctorFailedMsg(`Failed to check rule health: ${reason}`);
			}
			process.exitCode = 1;
		}
	});

export default doctorRuleAction;
