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
	const plan = buildDryRunPlan(profile, current);
	console.log();
	console.log(`${infoIcon} Dry run: no Git config changes were written.`);
	console.log(`${infoIcon} Scope  ${chalk.green(scope)}`);
	console.log(`${infoIcon} Profile ${chalk.green(`'${profile.name}'`)}`);
	console.log();
	for (const step of plan) {
		const actionLabel =
			step.action === "set" ? chalk.green("SET") : chalk.yellow("UNSET");
		console.log(
			`${infoIcon} ${step.key} ${actionLabel} ${formatValue(step.before)} -> ${formatValue(step.after)}`,
		);
	}
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
	const plan = buildDryRunPlan(profile, current);
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
				changes: plan.map((item) => ({
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

type DryRunAction = "set" | "unset";

interface DryRunStep {
	key: "user.name" | "user.email" | "user.signingkey";
	action: DryRunAction;
	before: string | null;
	after: string | null;
}

function buildDryRunPlan(
	profile: Profile,
	current: {
		gitName: string | null;
		email: string | null;
		signingKey: string | null;
	},
): DryRunStep[] {
	return [
		{
			key: "user.name",
			action: "set",
			before: current.gitName,
			after: profile.gitName,
		},
		{
			key: "user.email",
			action: "set",
			before: current.email,
			after: profile.email,
		},
		{
			key: "user.signingkey",
			action: profile.signingKey ? "set" : "unset",
			before: current.signingKey,
			after: profile.signingKey ?? null,
		},
	];
}

function formatValue(value: string | null): string {
	return value === null ? chalk.dim("<unset>") : chalk.white(value);
}
