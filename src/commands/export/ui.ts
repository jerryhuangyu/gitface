import chalk from "chalk";

const successIcon = chalk.green("✔");

export const sendExportSuccessMsg = (count: number, file: string): void => {
	console.log();
	console.log(`${successIcon} Exported ${count} profiles to '${file}'.`);
};

export const sendExportStdout = (json: string): void => {
	console.log(json);
};

export const sendExportSuccessJson = (result: {
	count: number;
	file?: string;
	profiles?: unknown[];
}): void => {
	console.log(
		JSON.stringify({
			status: "exported",
			...result,
		}),
	);
};

export const sendExportFailedJson = (reason: string, file?: string): void => {
	console.log(
		JSON.stringify({
			status: "error",
			reason,
			...(file ? { file } : {}),
		}),
	);
};
