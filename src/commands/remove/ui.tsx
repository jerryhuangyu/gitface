import chalk from "chalk";
import type { Profile } from "@/domain/profile";

const infoIcon = chalk.blue("ℹ");
const checkIcon = chalk.greenBright("✔");
const crossIcon = chalk.redBright("✖");

export const sendProfileRemoveSuccessMsg = (profile: Profile): void => {
	const name = profile.name;
	const gitName = profile.gitName;
	const email = profile.email;
	const signingKey = profile.signingKey ?? chalk.dim("<unset>");

	console.log();
	console.log(`${infoIcon} ${chalk.dim("user.name")}  ${gitName}`);
	console.log(`${infoIcon} ${chalk.dim("user.email")}  ${email}`);
	console.log(`${infoIcon} ${chalk.dim("signingKey")}  ${signingKey}`);
	console.log();
	console.log(`${checkIcon} Removed profile ${chalk.green(`'${name}'`)}`);
};

export const sendProfileRemoveDryRunMsg = (profile: Profile): void => {
	const signingKey = profile.signingKey ?? chalk.dim("<unset>");
	console.log();
	console.log(`${infoIcon} Dry run: no profile files were deleted.`);
	console.log(`${infoIcon} ${chalk.dim("user.name")}  ${profile.gitName}`);
	console.log(`${infoIcon} ${chalk.dim("user.email")}  ${profile.email}`);
	console.log(`${infoIcon} ${chalk.dim("signingKey")}  ${signingKey}`);
	console.log();
	console.log(
		`${checkIcon} Would remove profile ${chalk.green(`'${profile.name}'`)}`,
	);
};

export const sendProfileRemoveWithForceMsg = (name: string): void => {
	console.log();
	console.log(`${infoIcon} '${name}' not found — skipped.`);
};

export const sendProfileRemoveFailedMsg = (reason: string): void => {
	console.log();
	console.log(`${crossIcon} Profile removal failed: ${chalk.red(reason)}`);
};

export const sendProfileRemoveSuccessJson = (profile: Profile): void => {
	console.log(
		JSON.stringify({
			status: "removed",
			name: profile.name,
			gitName: profile.gitName,
			email: profile.email,
			signingKey: profile.signingKey ?? null,
		}),
	);
};

export const sendProfileRemoveDryRunJson = (profile: Profile): void => {
	console.log(
		JSON.stringify({
			status: "dry-run",
			name: profile.name,
			gitName: profile.gitName,
			email: profile.email,
			signingKey: profile.signingKey ?? null,
		}),
	);
};

export const sendProfileRemoveSkippedJson = (name: string): void => {
	console.log(
		JSON.stringify({
			status: "skipped",
			name,
			force: true,
			reason: "Profile not found.",
		}),
	);
};

export const sendProfileRemoveFailedJson = (
	name: string,
	reason: string,
): void => {
	console.log(
		JSON.stringify({
			status: "error",
			name,
			reason,
		}),
	);
};
