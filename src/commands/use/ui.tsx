import chalk from "chalk";
import type { Profile } from "@/core/profile";

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
