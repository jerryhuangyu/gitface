import chalk from "chalk";
import type { Profile } from "@/domain/profile";

const checkIcon = chalk.greenBright("✔");
const crossIcon = chalk.redBright("✖");

export const sendProfileRenameSuccessMsg = (
	oldName: string,
	newName: string,
): void => {
	console.log();
	console.log(`${checkIcon} Renamed profile '${oldName}' to '${newName}'.`);
};

export const sendProfileRenameFailedMsg = (reason: string): void => {
	console.log();
	console.log(`${crossIcon} Profile rename failed: ${chalk.red(reason)}`);
};

export const sendProfileRenameSuccessJson = (
	oldName: string,
	profile: Profile,
): void => {
	console.log(
		JSON.stringify({
			status: "renamed",
			oldName,
			name: profile.name,
			gitName: profile.gitName,
			email: profile.email,
			signingKey: profile.signingKey ?? null,
		}),
	);
};

export const sendProfileRenameFailedJson = (
	oldName: string,
	newName: string,
	reason: string,
): void => {
	console.log(
		JSON.stringify({
			status: "error",
			oldName,
			newName,
			reason,
		}),
	);
};
