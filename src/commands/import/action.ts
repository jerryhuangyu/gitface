import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import process from "node:process";
import {
	executeProfileImport,
	type ImportResultItem,
	type ImportSummary,
} from "@/core/profile-import-service";
import { ProfileService } from "@/core/profile-service";
import { withCommandHandling } from "../command-runner";
import {
	type ImportEnvelopeData,
	sendImportDryRunSummary,
	sendImportEnvelopeError,
	sendImportEnvelopeSuccess,
	sendImportExistsWarning,
	sendImportFailedMsg,
	sendImportJsonSummary,
	sendImportSummary,
} from "./ui";

interface Options {
	overwrite?: boolean;
	atomic?: boolean;
	dryRun?: boolean;
	strict?: boolean;
	json?: boolean;
	jsonEnvelope?: boolean;
}

type OutputMode = "text" | "json" | "json-envelope";

const action: (file: string, options: Options) => Promise<void> =
	withCommandHandling(
		"command:import",
		async (file: string, options: Options) => {
			const startedAtMs = Date.now();
			const traceId = randomUUID();
			const outputMode = resolveOutputMode(options);
			const strict = options.strict ?? false;
			const dryRun = options.dryRun ?? false;
			const overwrite = options.overwrite ?? false;
			const atomic = options.atomic ?? false;

			let raw: unknown;
			try {
				const content = await fs.readFile(file, "utf-8");
				raw = JSON.parse(content);
			} catch (error) {
				if (outputMode === "json-envelope") {
					const message =
						error instanceof Error
							? error.message
							: "Failed to read import file.";
					sendImportEnvelopeError(
						"IMPORT_INPUT_INVALID",
						message,
						null,
						[{ code: "IMPORT_INPUT_INVALID", message }],
						Date.now() - startedAtMs,
						traceId,
					);
					process.exitCode = 1;
					return;
				}
				throw error;
			}

			if (!Array.isArray(raw)) {
				const message = "Invalid format: expected an array of profiles.";
				if (outputMode === "json-envelope") {
					sendImportEnvelopeError(
						"IMPORT_INPUT_INVALID",
						message,
						null,
						[{ code: "IMPORT_INPUT_INVALID", message }],
						Date.now() - startedAtMs,
						traceId,
					);
					process.exitCode = 1;
					return;
				}
				throw new Error(message);
			}

			const service = ProfileService.create();
			const importReport = await executeProfileImport(raw, service, {
				dryRun,
				overwrite,
				atomic,
			});
			const summary = importReport.summary;
			if (importReport.atomicAborted) {
				process.exitCode = 1;
			}

			if (outputMode === "json-envelope") {
				writeImportEnvelopeResult(
					summary,
					importReport.results,
					{
						file,
						strict,
						overwrite,
						atomic,
					},
					{
						startedAtMs,
						traceId,
						atomicAborted: importReport.atomicAborted,
					},
				);
				return;
			}

			if (strict && summary.failed > 0) {
				process.exitCode = 1;
			}

			if (outputMode === "json") {
				sendImportJsonSummary(summary);
				return;
			}

			renderImportTextResults(importReport.results, dryRun);
			if (dryRun) {
				sendImportDryRunSummary(summary.imported, summary.failed);
				return;
			}
			sendImportSummary(summary.imported, summary.failed);
		},
	);

function writeImportEnvelopeResult(
	summary: ImportSummary,
	results: ImportResultItem[],
	baseData: Omit<ImportEnvelopeData, keyof ImportSummary>,
	meta: { startedAtMs: number; traceId: string; atomicAborted: boolean },
): void {
	const data: ImportEnvelopeData = {
		...summary,
		...baseData,
	};
	const durationMs = Date.now() - meta.startedAtMs;

	if (meta.atomicAborted) {
		sendImportEnvelopeError(
			"IMPORT_PROFILES_ATOMIC_ABORTED",
			"Atomic precheck failed; no profiles were written.",
			data,
			buildEnvelopeErrors(results, "IMPORT_PROFILE_ATOMIC_FAILED"),
			durationMs,
			meta.traceId,
		);
		process.exitCode = 1;
		return;
	}

	if (baseData.strict && summary.failed > 0) {
		sendImportEnvelopeError(
			"IMPORT_PROFILES_STRICT_FAILED",
			"Import completed with failures in strict mode.",
			data,
			buildEnvelopeErrors(results, "IMPORT_PROFILE_FAILED"),
			durationMs,
			meta.traceId,
		);
		process.exitCode = 1;
		return;
	}

	if (summary.failed > 0) {
		sendImportEnvelopeSuccess(
			"IMPORT_PROFILES_PARTIAL",
			"Import completed with partial failures.",
			data,
			durationMs,
			meta.traceId,
		);
		return;
	}

	sendImportEnvelopeSuccess(
		"IMPORT_PROFILES_OK",
		summary.dryRun
			? "Dry-run import validation completed successfully."
			: "Profiles imported successfully.",
		data,
		durationMs,
		meta.traceId,
	);
}

function buildEnvelopeErrors(
	results: ImportResultItem[],
	defaultCode: string,
): Array<{ code: string; message: string }> {
	return results
		.filter((result) => result.status === "failed")
		.map((result) => ({
			code:
				result.kind === "exists"
					? "IMPORT_PROFILE_EXISTS"
					: result.kind === "atomic-skipped"
						? "IMPORT_PROFILE_ATOMIC_SKIPPED"
						: defaultCode,
			message: `${result.name}: ${result.message}`,
		}));
}

function renderImportTextResults(
	results: ImportResultItem[],
	dryRun: boolean,
): void {
	for (const result of results) {
		if (result.status !== "failed") {
			continue;
		}
		if (result.kind === "exists") {
			sendImportExistsWarning(result.name, dryRun);
			continue;
		}
		sendImportFailedMsg(result.name, result.message, dryRun);
	}
}

function resolveOutputMode(options: Options): OutputMode {
	if (options.jsonEnvelope === true) {
		return "json-envelope";
	}
	if (options.json === true) {
		return "json";
	}
	return "text";
}

export default action;
