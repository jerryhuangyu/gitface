import chalk from "chalk";

export function sendRuleAddSuccessMsg(
	directory: string,
	profileName: string,
): void {
	console.log(
		chalk.green(
			`Rule added: ${chalk.cyan(directory)} matches profile ${chalk.bold(profileName)}`,
		),
	);
}

export function sendRuleAddSuccessJson(
	directory: string,
	profileName: string,
): void {
	console.log(
		JSON.stringify({
			status: "added",
			directory,
			profileName,
		}),
	);
}

export function sendRuleAddDryRunMsg(
	directory: string,
	profileName: string,
	overwrite: boolean,
): void {
	console.log(chalk.blue("Dry run: no git config was changed."));
	if (overwrite) {
		console.log(
			chalk.green(
				`Rule would be updated: ${chalk.cyan(directory)} matches profile ${chalk.bold(profileName)}`,
			),
		);
		return;
	}
	console.log(
		chalk.green(
			`Rule would be added: ${chalk.cyan(directory)} matches profile ${chalk.bold(profileName)}`,
		),
	);
}

export function sendRuleAddDryRunJson(
	directory: string,
	profileName: string,
	overwrite: boolean,
): void {
	console.log(
		JSON.stringify({
			status: "dry-run",
			directory,
			profileName,
			overwrite,
		}),
	);
}

export function sendRuleAddFailedMsg(reason: string): void {
	console.error(chalk.red(reason));
}

export function sendRuleAddFailedJson(
	directory: string,
	profileName: string,
	reason: string,
): void {
	console.log(
		JSON.stringify({
			status: "error",
			directory,
			profileName,
			reason,
		}),
	);
}

export function sendRuleRemoveSuccessMsg(directory: string): void {
	console.log(
		chalk.green(`Rule removed for directory: ${chalk.cyan(directory)}`),
	);
}

export function sendRuleRemoveSuccessJson(directory: string): void {
	console.log(
		JSON.stringify({
			status: "removed",
			directory,
		}),
	);
}

export function sendRuleRemoveDryRunMsg(
	directory: string,
	exists: boolean,
): void {
	console.log(chalk.blue("Dry run: no git config was changed."));
	if (exists) {
		console.log(
			chalk.green(`Rule would be removed for: ${chalk.cyan(directory)}`),
		);
		return;
	}
	console.log(
		chalk.yellow(
			`No matching rule found for: ${chalk.cyan(directory)} (would be a no-op)`,
		),
	);
}

export function sendRuleRemoveDryRunJson(
	directory: string,
	exists: boolean,
): void {
	console.log(
		JSON.stringify({
			status: "dry-run",
			directory,
			exists,
		}),
	);
}

export function sendRuleRemoveFailedMsg(reason: string): void {
	console.error(chalk.red(reason));
}

export function sendRuleRemoveFailedJson(
	directory: string,
	reason: string,
): void {
	console.log(
		JSON.stringify({
			status: "error",
			directory,
			reason,
		}),
	);
}
