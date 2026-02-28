import chalk from "chalk";
import type { Profile } from "@/domain/profile";

export const sendProfileCreateSuccessMsg = (profile: Profile): void => {
	const name = profile.name;
	const gitName = profile.gitName;
	const email = profile.email;
	const signingKey = profile.signingKey ?? chalk.dim("<unset>");

	const infoIcon = chalk.blue("ℹ");
	const checkIcon = chalk.greenBright("✔");

	console.log(`${infoIcon} ${chalk.dim("user.name")}  ${gitName}`);
	console.log(`${infoIcon} ${chalk.dim("user.email")}  ${email}`);
	console.log(`${infoIcon} ${chalk.dim("signingKey")}  ${signingKey}`);
	console.log();
	console.log(`${checkIcon} Saved profile ${chalk.green(`'${name}'`)}`);
};

export const sendProfileCreateSuccessJson = (profile: Profile): void => {
	console.log(
		JSON.stringify({
			status: "created",
			name: profile.name,
			gitName: profile.gitName,
			email: profile.email,
			signingKey: profile.signingKey ?? null,
		}),
	);
};

export const sendProfileCreateFailedJson = (
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
