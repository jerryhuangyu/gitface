import chalk from "chalk";

const successIcon = chalk.green("✔");
const warningIcon = chalk.yellow("⚠");
const failureIcon = chalk.red("✖");

export const sendImportExistsWarning = (name: string, dryRun = false): void => {
	if (dryRun) {
		console.warn(
			`${warningIcon} [dry-run] Profile '${name}' already exists and would be skipped. Use --overwrite to replace.`,
		);
		return;
	}

	console.warn(
		`${warningIcon} Profile '${name}' already exists. Use --overwrite to replace.`,
	);
};

export const sendImportFailedMsg = (
	name: string,
	reason: string,
	dryRun = false,
): void => {
	if (dryRun) {
		console.error(
			`${failureIcon} [dry-run] Failed to validate '${name}': ${reason}`,
		);
		return;
	}

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

export const sendImportDryRunSummary = (
	successCount: number,
	failCount: number,
): void => {
	const failureNote =
		failCount > 0 ? ` ${chalk.red(`${failCount} failed validation.`)}` : "";
	console.log();
	console.log(
		`${successIcon} Dry-run complete. ${successCount} profiles ready to import.${failureNote}`,
	);
};
