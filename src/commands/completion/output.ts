import {
	buildResultEnvelope,
	type ResultEnvelope,
} from "@/core/result-envelope";

type CompletionTopic = "profiles";

interface CompletionProfilesJsonOutput {
	topic: CompletionTopic;
	prefix: string | null;
	limit: number | null;
	count: number;
	names: string[];
}

interface CompletionProfilesEnvelopeData extends CompletionProfilesJsonOutput {}

export function writeCompletionProfilesJsonLegacy(
	payload: CompletionProfilesJsonOutput,
): void {
	process.stdout.write(`${JSON.stringify(payload)}\n`);
}

export function writeCompletionProfilesEnvelopeSuccess(
	data: CompletionProfilesEnvelopeData,
	durationMs: number,
	traceId: string,
): void {
	writeEnvelope(
		buildResultEnvelope({
			status: "success",
			code: "COMPLETION_PROFILES_OK",
			message: "Completion profiles resolved.",
			data,
			errors: [],
			durationMs,
			traceId,
		}),
	);
}

export function writeCompletionProfilesEnvelopeError(
	errorCode: string,
	message: string,
	durationMs: number,
	traceId: string,
): void {
	writeEnvelope(
		buildResultEnvelope({
			status: "error",
			code: errorCode,
			message,
			data: null,
			errors: [{ code: errorCode, message }],
			durationMs,
			traceId,
		}),
	);
}

function writeEnvelope(
	envelope: ResultEnvelope<CompletionProfilesEnvelopeData | null>,
): void {
	process.stdout.write(`${JSON.stringify(envelope)}\n`);
}

export type { CompletionProfilesJsonOutput };
