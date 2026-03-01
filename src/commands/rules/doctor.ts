import process from "node:process";
import { RuleService } from "@/core/rule-service";
import { withCommandHandling } from "../command-runner";
import { parseConcurrency, scanRuleIntegrity } from "./integrity";
import {
	type RuleDoctorReport,
	sendRuleDoctorFailedJson,
	sendRuleDoctorFailedMsg,
	sendRuleDoctorReportJson,
	sendRuleDoctorReportMsg,
} from "./ui";

interface RuleDoctorOptions {
	json?: boolean;
	strict?: boolean;
	concurrency?: string;
}

const isMissingGlobalConfigError = (error: unknown): boolean => {
	return (
		error instanceof Error &&
		error.message.toLowerCase().includes("unable to read config file")
	);
};

async function buildDoctorReport(
	concurrency: number,
): Promise<RuleDoctorReport> {
	const ruleService = RuleService.create();
	const rules = await ruleService.listRules().catch((error) => {
		if (isMissingGlobalConfigError(error)) {
			return [];
		}
		throw error;
	});

	const integrityResults = await scanRuleIntegrity(rules, {
		checkDirectory: true,
		concurrency,
	});
	const results = integrityResults.records.map((result) => ({
		...result,
		status: !result.profileExists
			? ("fail" as const)
			: result.directoryExists
				? ("pass" as const)
				: ("warn" as const),
	}));

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
		metrics: integrityResults.metrics,
		results,
	};
}

const doctorRuleAction: (options: RuleDoctorOptions) => Promise<void> =
	withCommandHandling("command:rules:doctor", async (options) => {
		const strictMode = options.strict ?? false;

		try {
			const concurrency = parseConcurrency(options.concurrency);
			const report = await buildDoctorReport(concurrency);
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
