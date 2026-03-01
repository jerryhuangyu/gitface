import chalk from "chalk";
import type { ImportSummary } from "@/core/profile-import-service";
import {
	buildResultEnvelope,
	type ResultEnvelope,
} from "@/core/result-envelope";

const successIcon = chalk.green("✔");
const warningIcon = chalk.yellow("⚠");
const failureIcon = chalk.red("✖");

interface ImportEnvelopeData extends ImportSummary {
	file: string;
	strict: boolean;
	overwrite: boolean;
	atomic: boolean;
}

export const sendImportExistsWarning = (name: string, dryRun = false): void => {
	if (dryRun) {
		console.warn(
			`${warningIcon} [dry-run] Profile '${name}' already exists and would be skipped. Use --overwrite to replace.`,
		);
		return;
	}

	console.warn(
		`${warningIcon} Profile '${name}' already exists. Use --overwrite to replace.`,
	);
};

export const sendImportFailedMsg = (
	name: string,
	reason: string,
	dryRun = false,
): void => {
	if (dryRun) {
		console.error(
			`${failureIcon} [dry-run] Failed to validate '${name}': ${reason}`,
		);
		return;
	}

	console.error(`${failureIcon} Failed to import '${name}': ${reason}`);
};

export const sendImportSummary = (
	successCount: number,
	failCount: number,
): void => {
	const failureNote =
		failCount > 0 ? ` ${chalk.red(`${failCount} failed.`)}` : "";
	console.log();
	console.log(
		`${successIcon} Imported ${successCount} profiles.${failureNote}`,
	);
};

export const sendImportDryRunSummary = (
	successCount: number,
	failCount: number,
): void => {
	const failureNote =
		failCount > 0 ? ` ${chalk.red(`${failCount} failed validation.`)}` : "";
	console.log();
	console.log(
		`${successIcon} Dry-run complete. ${successCount} profiles ready to import.${failureNote}`,
	);
};

export const sendImportJsonSummary = (summary: ImportSummary): void => {
	console.log(JSON.stringify(summary, null, 2));
};

export const sendImportEnvelopeSuccess = (
	code: string,
	message: string,
	data: ImportEnvelopeData,
	durationMs: number,
	traceId: string,
): void => {
	writeImportEnvelope(
		buildResultEnvelope({
			status: "success",
			code,
			message,
			data,
			errors: [],
			durationMs,
			traceId,
		}),
	);
};

export const sendImportEnvelopeError = (
	code: string,
	message: string,
	data: ImportEnvelopeData | null,
	errorItems: Array<{ code: string; message: string }>,
	durationMs: number,
	traceId: string,
): void => {
	writeImportEnvelope(
		buildResultEnvelope({
			status: "error",
			code,
			message,
			data,
			errors: errorItems,
			durationMs,
			traceId,
		}),
	);
};

function writeImportEnvelope(
	envelope: ResultEnvelope<ImportEnvelopeData | null>,
): void {
	console.log(JSON.stringify(envelope));
}

export type { ImportEnvelopeData };
