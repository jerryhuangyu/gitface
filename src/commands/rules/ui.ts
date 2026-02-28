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
