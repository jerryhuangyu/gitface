import chalk from "chalk";
import type { Profile } from "@/domain/profile";

const checkIcon = chalk.greenBright("✔");
const crossIcon = chalk.redBright("✖");
const infoIcon = chalk.blue("ℹ");

export const sendProfileCloneSuccessMsg = (
	sourceName: string,
	newName: string,
): void => {
	console.log();
	console.log(`${checkIcon} Cloned profile '${sourceName}' to '${newName}'.`);
};

export const sendProfileCloneFailedMsg = (reason: string): void => {
	console.log();
	console.log(`${crossIcon} Profile clone failed: ${chalk.red(reason)}`);
};

export const sendProfileCloneDryRunMsg = (
	sourceName: string,
	targetName: string,
	profile: Profile,
	overwrite: boolean,
): void => {
	const signingKey = profile.signingKey ?? chalk.dim("<unset>");
	console.log();
	console.log(`${infoIcon} Dry run: no profile files were changed.`);
	console.log(`${infoIcon} ${chalk.dim("from")}  '${sourceName}'`);
	console.log(`${infoIcon} ${chalk.dim("to")}  '${targetName}'`);
	console.log(
		`${infoIcon} ${chalk.dim("overwrite")}  ${overwrite ? "yes" : "no"}`,
	);
	console.log(`${infoIcon} ${chalk.dim("user.name")}  ${profile.gitName}`);
	console.log(`${infoIcon} ${chalk.dim("user.email")}  ${profile.email}`);
	console.log(`${infoIcon} ${chalk.dim("signingKey")}  ${signingKey}`);
	console.log();
	console.log(
		`${checkIcon} Would clone profile '${sourceName}' to '${targetName}'.`,
	);
};

export const sendProfileCloneSuccessJson = (
	sourceName: string,
	profile: Profile,
): void => {
	console.log(
		JSON.stringify({
			status: "cloned",
			sourceName,
			name: profile.name,
			gitName: profile.gitName,
			email: profile.email,
			signingKey: profile.signingKey ?? null,
		}),
	);
};

export const sendProfileCloneFailedJson = (
	sourceName: string,
	targetName: string,
	reason: string,
): void => {
	console.log(
		JSON.stringify({
			status: "error",
			sourceName,
			targetName,
			reason,
		}),
	);
};

export const sendProfileCloneDryRunJson = (
	sourceName: string,
	targetName: string,
	profile: Profile,
	overwrite: boolean,
): void => {
	console.log(
		JSON.stringify({
			status: "dry-run",
			sourceName,
			targetName,
			overwrite,
			gitName: profile.gitName,
			email: profile.email,
			signingKey: profile.signingKey ?? null,
		}),
	);
};
