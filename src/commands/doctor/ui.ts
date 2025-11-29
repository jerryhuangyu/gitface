import chalk from "chalk";

export type DoctorCheckStatus = "pass" | "fail" | "warn";

export interface DoctorCheckResult {
	status: DoctorCheckStatus;
	message: string;
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

export const sendDoctorSummary = (hasFailures: boolean): void => {
	console.log();
	if (hasFailures) {
		console.log(
			chalk.red("✖ Some checks failed. Please review the issues above."),
		);
		return;
	}

	console.log(chalk.green("✔ All checks passed. You are good to go!"));
};
