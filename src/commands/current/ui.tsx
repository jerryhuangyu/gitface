import chalk from "chalk";
import type { GitIdentity } from "@/core/git-service";

const infoIcon = chalk.blue("ℹ");

export const sendCurrentIdentityMsg = (identity: GitIdentity): void => {
	const gitName = identity.gitName;
	const email = identity.email;
	const signingKey = identity.signingKey ?? chalk.dim("<unset>");

	console.log();
	console.log("Current Git identity:");
	console.log();
	console.log(`${infoIcon} ${chalk.dim("user.name")}  ${gitName}`);
	console.log(`${infoIcon} ${chalk.dim("user.email")}  ${email}`);
	console.log(`${infoIcon} ${chalk.dim("signingKey")}  ${signingKey}`);
	console.log();
};
