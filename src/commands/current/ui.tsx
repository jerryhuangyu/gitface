import chalk from "chalk";
import type { ConfigScope, GitIdentity } from "@/core/git-service";

const infoIcon = chalk.blue("ℹ");
const errorIcon = chalk.red("✖");

export const sendCurrentIdentityMsg = (
	identity: GitIdentity,
	scope?: ConfigScope,
): void => {
	const heading = scope
		? `Current Git identity (${scope} scope):`
		: "Current Git identity:";
	const gitName = identity.gitName ?? chalk.dim("<unset>");
	const email = identity.email ?? chalk.dim("<unset>");
	const signingKey = identity.signingKey ?? chalk.dim("<unset>");

	console.log();
	console.log(heading);
	console.log();
	console.log(`${infoIcon} ${chalk.dim("user.name")}  ${gitName}`);
	console.log(`${infoIcon} ${chalk.dim("user.email")}  ${email}`);
	console.log(`${infoIcon} ${chalk.dim("signingKey")}  ${signingKey}`);
	console.log();
};

export const sendCurrentIdentityJson = (
	identity: GitIdentity,
	scope?: ConfigScope,
): void => {
	console.log(
		JSON.stringify(
			{
				gitName: identity.gitName,
				email: identity.email,
				signingKey: identity.signingKey ?? null,
				...(scope ? { scope } : {}),
			},
			null,
			2,
		),
	);
};

export const sendCurrentIdentityFailedMsg = (reason: string): void => {
	console.error(`${errorIcon} ${reason}`);
};

export const sendCurrentIdentityFailedJson = (reason: string): void => {
	console.log(
		JSON.stringify(
			{
				status: "error",
				reason,
			},
			null,
			2,
		),
	);
};
