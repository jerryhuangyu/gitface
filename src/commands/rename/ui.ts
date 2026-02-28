import chalk from "chalk";
import type { Profile } from "@/domain/profile";

const checkIcon = chalk.greenBright("✔");
const crossIcon = chalk.redBright("✖");
const infoIcon = chalk.blue("ℹ");

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

export const sendProfileRenameDryRunMsg = (
	oldName: string,
	newName: string,
	profile: Profile,
	overwrite: boolean,
): void => {
	const signingKey = profile.signingKey ?? chalk.dim("<unset>");
	console.log();
	console.log(`${infoIcon} Dry run: no profile files were changed.`);
	console.log(`${infoIcon} ${chalk.dim("from")}  '${oldName}'`);
	console.log(`${infoIcon} ${chalk.dim("to")}  '${newName}'`);
	console.log(
		`${infoIcon} ${chalk.dim("overwrite")}  ${overwrite ? "yes" : "no"}`,
	);
	console.log(`${infoIcon} ${chalk.dim("user.name")}  ${profile.gitName}`);
	console.log(`${infoIcon} ${chalk.dim("user.email")}  ${profile.email}`);
	console.log(`${infoIcon} ${chalk.dim("signingKey")}  ${signingKey}`);
	console.log();
	console.log(
		`${checkIcon} Would rename profile '${oldName}' to '${newName}'.`,
	);
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

export const sendProfileRenameDryRunJson = (
	oldName: string,
	newName: string,
	profile: Profile,
	overwrite: boolean,
): void => {
	console.log(
		JSON.stringify({
			status: "dry-run",
			oldName,
			newName,
			overwrite,
			gitName: profile.gitName,
			email: profile.email,
			signingKey: profile.signingKey ?? null,
		}),
	);
};
