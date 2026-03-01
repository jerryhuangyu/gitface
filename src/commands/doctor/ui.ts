import chalk from "chalk";
import {
	buildResultEnvelope,
	type ResultEnvelope,
	type ResultEnvelopeError,
} from "@/core/result-envelope";

export type DoctorCheckStatus = "pass" | "fail" | "warn";

export interface DoctorCheckResult {
	status: DoctorCheckStatus;
	message: string;
}

export interface DoctorReport {
	checks: DoctorCheckResult[];
	hasFailures: boolean;
	hasWarnings: boolean;
}

interface DoctorSummary {
	total: number;
	pass: number;
	warn: number;
	fail: number;
}

interface DoctorEnvelopeData {
	strict: boolean;
	hasFatalChecks: boolean;
	summary: DoctorSummary;
	checks: DoctorCheckResult[];
}

const successIcon = chalk.green("✔");
const warningIcon = chalk.yellow("⚠");
const failureIcon = chalk.red("✖");

export const sendDoctorHeading = (): void => {
	console.log(chalk.bold("GitFace Doctor"));
	console.log();
};

export const sendDoctorCheckResult = (result: DoctorCheckResult): void => {
	const icon =
		result.status === "pass"
			? successIcon
			: result.status === "warn"
				? warningIcon
				: failureIcon;

	console.log(`${icon} ${result.message}`);
};

export const sendDoctorSummary = (
	hasFailures: boolean,
	hasWarnings: boolean,
	strict: boolean,
): void => {
	console.log();
	if (hasFailures) {
		console.log(
			chalk.red("✖ Some checks failed. Please review the issues above."),
		);
		return;
	}
	if (strict && hasWarnings) {
		console.log(
			chalk.red(
				"✖ Strict mode failed because warnings were detected. Resolve warnings or rerun without --strict.",
			),
		);
		return;
	}

	console.log(chalk.green("✔ All checks passed. You are good to go!"));
};

export const sendDoctorReportJson = (report: DoctorReport): void => {
	console.log(
		JSON.stringify(
			{
				checks: report.checks,
				hasFailures: report.hasFailures,
				hasWarnings: report.hasWarnings,
			},
			null,
			2,
		),
	);
};

export const sendDoctorReportEnvelopeSuccess = (
	report: DoctorReport,
	strict: boolean,
	durationMs: number,
	traceId: string,
): void => {
	writeDoctorEnvelope(
		buildResultEnvelope({
			status: "success",
			code: "DOCTOR_CHECKS_OK",
			message: "Doctor checks passed.",
			data: {
				strict,
				hasFatalChecks: false,
				summary: summarizeDoctorChecks(report),
				checks: report.checks,
			},
			errors: [],
			durationMs,
			traceId,
		}),
	);
};

export const sendDoctorReportEnvelopeError = (
	report: DoctorReport,
	strict: boolean,
	durationMs: number,
	traceId: string,
): void => {
	const hasFailures = report.hasFailures;
	const message = hasFailures
		? "Doctor checks failed."
		: "Doctor checks failed in strict mode due to warnings.";

	writeDoctorEnvelope(
		buildResultEnvelope({
			status: "error",
			code: "DOCTOR_CHECKS_FAILED",
			message,
			data: {
				strict,
				hasFatalChecks: true,
				summary: summarizeDoctorChecks(report),
				checks: report.checks,
			},
			errors: toFatalErrors(report, strict),
			durationMs,
			traceId,
		}),
	);
};

function summarizeDoctorChecks(report: DoctorReport): DoctorSummary {
	const summary: DoctorSummary = {
		total: report.checks.length,
		pass: 0,
		warn: 0,
		fail: 0,
	};
	for (const check of report.checks) {
		if (check.status === "pass") {
			summary.pass += 1;
		} else if (check.status === "warn") {
			summary.warn += 1;
		} else {
			summary.fail += 1;
		}
	}
	return summary;
}

function toFatalErrors(
	report: DoctorReport,
	strict: boolean,
): ResultEnvelopeError[] {
	const errors: ResultEnvelopeError[] = [];
	for (const check of report.checks) {
		if (check.status === "fail") {
			errors.push({
				code: "DOCTOR_CHECK_FAILED",
				message: check.message,
			});
		}
		if (strict && check.status === "warn") {
			errors.push({
				code: "DOCTOR_CHECK_WARN_STRICT",
				message: check.message,
			});
		}
	}
	return errors;
}

function writeDoctorEnvelope(
	envelope: ResultEnvelope<DoctorEnvelopeData>,
): void {
	console.log(JSON.stringify(envelope));
}
