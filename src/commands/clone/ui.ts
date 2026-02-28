import chalk from "chalk";
import type { Profile } from "@/domain/profile";

const checkIcon = chalk.greenBright("✔");
const crossIcon = chalk.redBright("✖");

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
