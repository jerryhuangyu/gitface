import chalk from "chalk";

const successIcon = chalk.green("✔");

export const sendExportSuccessMsg = (count: number, file: string): void => {
	console.log();
	console.log(`${successIcon} Exported ${count} profiles to '${file}'.`);
};

export const sendExportStdout = (json: string): void => {
	console.log(json);
};
