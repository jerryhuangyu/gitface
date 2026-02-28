import chalk from "chalk";
import type { Profile } from "@/domain/profile";

export const sendProfileUpdateSuccessMsg: (profileName: string) => void = (
	profileName,
) => {
	console.log(`\n${chalk.green("✔")} Updated profile '${profileName}'.`);
};

export const sendProfileUpdateDryRunMsg: (profileName: string) => void = (
	profileName,
) => {
	console.log(`\n${chalk.blue("ℹ")} Dry run: no profile files were changed.`);
	console.log(`${chalk.green("✔")} Would update profile '${profileName}'.`);
};

export const sendProfileUpdateSuccessJson = (profile: Profile): void => {
	console.log(
		JSON.stringify({
			status: "updated",
			name: profile.name,
			gitName: profile.gitName,
			email: profile.email,
			signingKey: profile.signingKey ?? null,
		}),
	);
};

export const sendProfileUpdateDryRunJson = (profile: Profile): void => {
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

export const sendProfileUpdateFailedJson = (
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
