import chalk from "chalk";

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
