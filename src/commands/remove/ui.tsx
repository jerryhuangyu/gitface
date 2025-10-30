import chalk from "chalk";
import type { Profile } from "@/core/profile";

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

export const sendProfileRemoveWithForceMsg = (name: string): void => {
	console.log();
	console.log(`${infoIcon} '${name}' not found — skipped.`);
};

export const sendProfileRemoveFailedMsg = (reason: string): void => {
	console.log();
	console.log(`${crossIcon} Profile removal failed: ${chalk.red(reason)}`);
};
