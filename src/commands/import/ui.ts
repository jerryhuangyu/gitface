import chalk from "chalk";

const successIcon = chalk.green("✔");
const warningIcon = chalk.yellow("⚠");
const failureIcon = chalk.red("✖");

export const sendImportExistsWarning = (name: string): void => {
	console.warn(
		`${warningIcon} Profile '${name}' already exists. Use --overwrite to replace.`,
	);
};

export const sendImportFailedMsg = (name: string, reason: string): void => {
	console.error(`${failureIcon} Failed to import '${name}': ${reason}`);
};

export const sendImportSummary = (
	successCount: number,
	failCount: number,
): void => {
	const failureNote =
		failCount > 0 ? ` ${chalk.red(`${failCount} failed.`)}` : "";
	console.log();
	console.log(
		`${successIcon} Imported ${successCount} profiles.${failureNote}`,
	);
};
