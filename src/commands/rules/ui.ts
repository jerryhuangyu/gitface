import chalk from "chalk";
import type { ConfigScope } from "@/core/git-service";
import type { FolderRule } from "@/core/rule-service";
import type { Profile } from "@/domain/profile";
import type { UseChangeStep } from "../use/output";

export interface RuleDoctorResult {
	directory: string;
	profileName: string;
	status: "pass" | "warn" | "fail";
	profileExists: boolean;
	directoryExists: boolean;
}

export interface RuleDoctorReport {
	status: "ok" | "issues";
	summary: {
		total: number;
		pass: number;
		warn: number;
		fail: number;
	};
	results: RuleDoctorResult[];
}

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

export function sendRuleResolveMatchedMsg(
	targetDirectory: string,
	matchedRule: FolderRule,
	profileExists: boolean,
): void {
	console.log(chalk.bold("Resolved folder rule:"));
	console.log(
		`${chalk.cyan(targetDirectory)} ${chalk.gray("=>")} ${chalk.green(matchedRule.profileName)} ${chalk.gray(`(${matchedRule.directory})`)}`,
	);
	if (!profileExists) {
		console.log(
			chalk.yellow(
				`Warning: matched profile '${matchedRule.profileName}' does not exist in local profile store.`,
			),
		);
	}
}

export function sendRuleResolveMatchedJson(
	targetDirectory: string,
	matchedRule: FolderRule,
	profileExists: boolean,
): void {
	console.log(
		JSON.stringify({
			status: "matched",
			directory: targetDirectory,
			matchedRule,
			profileExists,
		}),
	);
}

export function sendRuleResolveUnmatchedMsg(targetDirectory: string): void {
	console.log(
		chalk.gray(`No folder rule matched target directory: ${targetDirectory}`),
	);
}

export function sendRuleResolveUnmatchedJson(targetDirectory: string): void {
	console.log(
		JSON.stringify({
			status: "unmatched",
			directory: targetDirectory,
			matchedRule: null,
			profileExists: null,
		}),
	);
}

export function sendRuleResolveFailedMsg(reason: string): void {
	console.error(chalk.red(reason));
}

export function sendRuleResolveFailedJson(
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

export function sendRuleApplyAppliedMsg(
	targetDirectory: string,
	matchedRule: FolderRule,
	scope: ConfigScope,
	profile: Profile,
): void {
	console.log(chalk.bold("Applied folder rule profile:"));
	console.log(
		`${chalk.cyan(targetDirectory)} ${chalk.gray("=>")} ${chalk.green(profile.name)} ${chalk.gray(`(${matchedRule.directory})`)}`,
	);
	console.log(
		chalk.green(
			`Applied to ${chalk.bold(scope)} scope with profile '${profile.name}'.`,
		),
	);
}

export function sendRuleApplyAppliedJson(
	targetDirectory: string,
	matchedRule: FolderRule,
	scope: ConfigScope,
	profile: Profile,
): void {
	console.log(
		JSON.stringify({
			status: "applied",
			directory: targetDirectory,
			scope,
			matchedRule,
			profile: {
				name: profile.name,
				gitName: profile.gitName,
				email: profile.email,
				signingKey: profile.signingKey ?? null,
			},
		}),
	);
}

export function sendRuleApplyUnchangedMsg(
	targetDirectory: string,
	matchedRule: FolderRule,
	scope: ConfigScope,
	profile: Profile,
): void {
	console.log(chalk.bold("Folder rule resolved:"));
	console.log(
		`${chalk.cyan(targetDirectory)} ${chalk.gray("=>")} ${chalk.green(profile.name)} ${chalk.gray(`(${matchedRule.directory})`)}`,
	);
	console.log(
		chalk.green(
			`Profile '${profile.name}' is already active for ${chalk.bold(scope)} scope. No changes were written.`,
		),
	);
}

export function sendRuleApplyUnchangedJson(
	targetDirectory: string,
	matchedRule: FolderRule,
	scope: ConfigScope,
	profile: Profile,
): void {
	console.log(
		JSON.stringify({
			status: "unchanged",
			directory: targetDirectory,
			scope,
			matchedRule,
			profile: {
				name: profile.name,
				gitName: profile.gitName,
				email: profile.email,
				signingKey: profile.signingKey ?? null,
			},
			changes: [],
		}),
	);
}

export function sendRuleApplyDryRunMsg(
	targetDirectory: string,
	matchedRule: FolderRule,
	scope: ConfigScope,
	profile: Profile,
	current: {
		gitName: string | null;
		email: string | null;
		signingKey: string | null;
	},
	changes: UseChangeStep[],
): void {
	console.log(chalk.blue("Dry run: no git config was changed."));
	console.log(
		`Resolved ${chalk.cyan(targetDirectory)} ${chalk.gray("=>")} ${chalk.green(profile.name)} ${chalk.gray(`(${matchedRule.directory})`)}`,
	);
	console.log(`${chalk.gray("Scope:")} ${chalk.green(scope)}`);
	if (changes.length === 0) {
		console.log(
			chalk.green(
				`No changes detected. Profile '${profile.name}' already matches ${scope} scope.`,
			),
		);
		return;
	}
	for (const change of changes) {
		const actionLabel = change.action === "unset" ? "UNSET" : "SET";
		console.log(
			`${chalk.gray(change.key)} ${chalk.yellow(actionLabel)} ${formatValue(change.before)} -> ${formatValue(change.after)}`,
		);
	}
	if (
		current.gitName === null &&
		current.email === null &&
		current.signingKey === null
	) {
		console.log(chalk.gray("Current identity is empty in target scope."));
	}
}

export function sendRuleApplyDryRunJson(
	targetDirectory: string,
	matchedRule: FolderRule,
	scope: ConfigScope,
	profile: Profile,
	current: {
		gitName: string | null;
		email: string | null;
		signingKey: string | null;
	},
	changes: UseChangeStep[],
): void {
	console.log(
		JSON.stringify({
			status: "dry-run",
			directory: targetDirectory,
			scope,
			matchedRule,
			profile: {
				name: profile.name,
				gitName: profile.gitName,
				email: profile.email,
				signingKey: profile.signingKey ?? null,
			},
			current,
			hasChanges: changes.length > 0,
			changes: changes.map((change) => ({
				key: change.key,
				action: change.action,
				before: change.before,
				after: change.after,
			})),
		}),
	);
}

export function sendRuleApplyUnmatchedMsg(
	targetDirectory: string,
	scope: ConfigScope,
): void {
	console.log(
		chalk.gray(
			`No folder rule matched target directory: ${targetDirectory} (scope: ${scope}).`,
		),
	);
}

export function sendRuleApplyUnmatchedJson(
	targetDirectory: string,
	scope: ConfigScope,
): void {
	console.log(
		JSON.stringify({
			status: "unmatched",
			directory: targetDirectory,
			scope,
			matchedRule: null,
		}),
	);
}

export function sendRuleApplyFailedMsg(reason: string): void {
	console.error(chalk.red(reason));
}

export function sendRuleApplyFailedJson(
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

export function sendRuleDoctorReportMsg(
	report: RuleDoctorReport,
	strict: boolean,
): void {
	console.log(chalk.bold("Folder rule health report:"));
	if (report.summary.total === 0) {
		console.log(chalk.gray("No folder rules found."));
		console.log(
			chalk.gray(
				`Summary: total=0 pass=0 warn=0 fail=0${strict ? " (strict mode)" : ""}`,
			),
		);
		return;
	}
	for (const result of report.results) {
		const label =
			result.status === "pass"
				? chalk.green("PASS")
				: result.status === "warn"
					? chalk.yellow("WARN")
					: chalk.red("FAIL");
		const details: string[] = [];
		if (!result.profileExists) {
			details.push("profile missing");
		}
		if (!result.directoryExists) {
			details.push("directory missing");
		}
		const detailText =
			details.length > 0 ? ` (${details.join(", ")})` : " (healthy)";
		console.log(
			`${label} ${chalk.cyan(result.directory)} -> ${chalk.bold(result.profileName)}${chalk.gray(detailText)}`,
		);
	}
	console.log(
		chalk.gray(
			`Summary: total=${report.summary.total} pass=${report.summary.pass} warn=${report.summary.warn} fail=${report.summary.fail}${strict ? " (strict mode)" : ""}`,
		),
	);
}

export function sendRuleDoctorReportJson(
	report: RuleDoctorReport,
	strict: boolean,
): void {
	console.log(
		JSON.stringify({
			status: report.status,
			strict,
			summary: report.summary,
			results: report.results,
		}),
	);
}

export function sendRuleDoctorFailedMsg(reason: string): void {
	console.error(chalk.red(reason));
}

export function sendRuleDoctorFailedJson(reason: string): void {
	console.log(
		JSON.stringify({
			status: "error",
			reason,
		}),
	);
}

function formatValue(value: string | null): string {
	return value === null ? chalk.dim("<unset>") : chalk.white(value);
}
