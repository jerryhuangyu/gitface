import chalk from "chalk";
import {
	buildResultEnvelope,
	type ResultEnvelope,
} from "@/core/result-envelope";

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

interface ExportEnvelopeData {
	count: number;
	file?: string;
	profiles?: unknown[];
}

export const sendExportEnvelopeSuccess = (
	code: string,
	message: string,
	data: ExportEnvelopeData,
	durationMs: number,
	traceId: string,
): void => {
	writeExportEnvelope(
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

export const sendExportEnvelopeError = (
	code: string,
	message: string,
	file: string | undefined,
	durationMs: number,
	traceId: string,
): void => {
	writeExportEnvelope(
		buildResultEnvelope({
			status: "error",
			code,
			message,
			data: file ? { count: 0, file } : null,
			errors: [{ code, message }],
			durationMs,
			traceId,
		}),
	);
};

function writeExportEnvelope(
	envelope: ResultEnvelope<ExportEnvelopeData | null>,
): void {
	console.log(JSON.stringify(envelope));
}
