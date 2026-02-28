import chalk from "chalk";
import type { ConfigScope } from "@/core/git-service";
import type { Profile } from "@/domain/profile";

const infoIcon = chalk.blue("ℹ");
const checkIcon = chalk.greenBright("✔");
const crossIcon = chalk.redBright("✖");

export const sendProfileUseSuccessMsg = (
	profile: Profile,
	scope: string,
): void => {
	const name = chalk.green(`'${profile.name}'`);
	const gitName = profile.gitName;
	const email = profile.email;
	const signingKey = profile.signingKey ?? chalk.dim("<unset>");
	const profileScope = chalk.green(scope);

	console.log();
	console.log(`${infoIcon} ${chalk.dim("user.name")}  ${gitName}`);
	console.log(`${infoIcon} ${chalk.dim("user.email")}  ${email}`);
	console.log(`${infoIcon} ${chalk.dim("signingKey")}  ${signingKey}`);
	console.log();
	console.log(
		`${checkIcon} Used profile ${name} to ${profileScope} Git config.`,
	);
};

export const sendProfileUseFailedMsg = (reason: string): void => {
	console.log();
	console.log(`${crossIcon} Profile use failed: ${chalk.red(reason)}`);
};

export const sendProfileUseDryRunMsg = (
	profile: Profile,
	scope: ConfigScope,
	current: {
		gitName: string | null;
		email: string | null;
		signingKey: string | null;
	},
): void => {
	const plan = buildUseChangePlan(profile, current);
	const effectiveChanges = getEffectiveChanges(plan);
	console.log();
	console.log(`${infoIcon} Dry run: no Git config changes were written.`);
	console.log(`${infoIcon} Scope  ${chalk.green(scope)}`);
	console.log(`${infoIcon} Profile ${chalk.green(`'${profile.name}'`)}`);
	console.log();
	if (effectiveChanges.length === 0) {
		console.log(
			`${checkIcon} No changes detected. Profile already matches ${chalk.green(scope)} scope.`,
		);
		return;
	}

	for (const step of effectiveChanges) {
		const actionLabel =
			step.action === "set" ? chalk.green("SET") : chalk.yellow("UNSET");
		console.log(
			`${infoIcon} ${step.key} ${actionLabel} ${formatValue(step.before)} -> ${formatValue(step.after)}`,
		);
	}
};

export const sendProfileUseNoopMsg = (
	profile: Profile,
	scope: ConfigScope,
): void => {
	console.log();
	console.log(
		`${checkIcon} Profile ${chalk.green(`'${profile.name}'`)} is already active for ${chalk.green(scope)} scope. No changes were written.`,
	);
};

export const sendProfileUseSuccessJson = (
	profile: Profile,
	scope: ConfigScope,
): void => {
	console.log(
		JSON.stringify(
			{
				name: profile.name,
				gitName: profile.gitName,
				email: profile.email,
				signingKey: profile.signingKey ?? null,
				scope,
			},
			null,
			2,
		),
	);
};

export const sendProfileUseFailedJson = (reason: string): void => {
	console.log(
		JSON.stringify(
			{
				error: reason,
			},
			null,
			2,
		),
	);
};

export const sendProfileUseDryRunJson = (
	profile: Profile,
	scope: ConfigScope,
	current: {
		gitName: string | null;
		email: string | null;
		signingKey: string | null;
	},
): void => {
	const plan = buildUseChangePlan(profile, current);
	const effectiveChanges = getEffectiveChanges(plan);
	console.log(
		JSON.stringify(
			{
				status: "dry-run",
				scope,
				profile: {
					name: profile.name,
					gitName: profile.gitName,
					email: profile.email,
					signingKey: profile.signingKey ?? null,
				},
				current,
				hasChanges: effectiveChanges.length > 0,
				changes: effectiveChanges.map((item) => ({
					key: item.key,
					action: item.action,
					before: item.before,
					after: item.after,
				})),
			},
			null,
			2,
		),
	);
};

export const sendProfileUseNoopJson = (
	profile: Profile,
	scope: ConfigScope,
): void => {
	console.log(
		JSON.stringify(
			{
				status: "unchanged",
				name: profile.name,
				gitName: profile.gitName,
				email: profile.email,
				signingKey: profile.signingKey ?? null,
				scope,
				changes: [],
			},
			null,
			2,
		),
	);
};

type UseChangeAction = "set" | "unset" | "unchanged";

export interface UseChangeStep {
	key: "user.name" | "user.email" | "user.signingkey";
	action: UseChangeAction;
	before: string | null;
	after: string | null;
}

export function buildUseChangePlan(
	profile: Profile,
	current: {
		gitName: string | null;
		email: string | null;
		signingKey: string | null;
	},
): UseChangeStep[] {
	const nextSigningKey = profile.signingKey ?? null;
	return [
		{
			key: "user.name",
			action: current.gitName === profile.gitName ? "unchanged" : "set",
			before: current.gitName,
			after: profile.gitName,
		},
		{
			key: "user.email",
			action: current.email === profile.email ? "unchanged" : "set",
			before: current.email,
			after: profile.email,
		},
		{
			key: "user.signingkey",
			action:
				current.signingKey === nextSigningKey
					? "unchanged"
					: nextSigningKey === null
						? "unset"
						: "set",
			before: current.signingKey,
			after: nextSigningKey,
		},
	];
}

export function getEffectiveChanges(plan: UseChangeStep[]): UseChangeStep[] {
	return plan.filter((step) => step.action !== "unchanged");
}

function formatValue(value: string | null): string {
	return value === null ? chalk.dim("<unset>") : chalk.white(value);
}
