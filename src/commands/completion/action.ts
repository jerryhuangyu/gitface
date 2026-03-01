import { randomUUID } from "node:crypto";
import process from "node:process";
import { ProfileService } from "@/core/profile-service";
import { withCommandHandling } from "../command-runner";
import {
	type CompletionProfilesJsonOutput,
	writeCompletionProfilesEnvelopeError,
	writeCompletionProfilesEnvelopeSuccess,
	writeCompletionProfilesJsonLegacy,
} from "./output";

interface CompletionOptions {
	prefix?: string;
	delimiter?: string;
	limit?: string;
	json?: boolean;
	jsonEnvelope?: boolean;
}

type CompletionTopic = "profiles";

function filterByPrefix(names: string[], prefix: string | undefined): string[] {
	if (prefix === undefined) {
		return names;
	}

	const normalizedPrefix = prefix.toLowerCase();
	return names.filter((name) =>
		name.toLowerCase().startsWith(normalizedPrefix),
	);
}

function parseLimit(value: string | undefined): number | undefined {
	if (value === undefined) {
		return undefined;
	}

	const normalized = value.trim();
	if (!/^\d+$/.test(normalized)) {
		throw new Error("Limit must be a positive integer.");
	}

	const limit = Number.parseInt(normalized, 10);
	if (limit < 1) {
		throw new Error("Limit must be a positive integer.");
	}

	return limit;
}

const action: (
	topic: CompletionTopic,
	options: CompletionOptions,
) => Promise<void> = withCommandHandling(
	"command:completion",
	async (topic, options) => {
		const startedAtMs = Date.now();
		const traceId = randomUUID();
		const normalizedTopic = topic.toLowerCase() as CompletionTopic;
		if (!["profiles"].includes(normalizedTopic)) {
			if (options.jsonEnvelope) {
				writeCompletionProfilesEnvelopeError(
					"COMPLETION_TOPIC_UNSUPPORTED",
					"Completion topic must be: profiles.",
					Date.now() - startedAtMs,
					traceId,
				);
			}
			process.exitCode = 1;
			return;
		}

		let limit: number | undefined;
		try {
			limit = parseLimit(options.limit);
		} catch (error) {
			if (!(error instanceof Error)) {
				throw error;
			}
			if (options.jsonEnvelope) {
				writeCompletionProfilesEnvelopeError(
					"COMPLETION_LIMIT_INVALID",
					error.message,
					Date.now() - startedAtMs,
					traceId,
				);
				process.exitCode = 1;
				return;
			}
			throw error;
		}

		const service = ProfileService.create();
		const names = await service.listProfileNames();
		const filteredNames = filterByPrefix(names, options.prefix).slice(0, limit);

		const jsonPayload: CompletionProfilesJsonOutput = {
			topic: normalizedTopic,
			prefix: options.prefix ?? null,
			limit: limit ?? null,
			count: filteredNames.length,
			names: filteredNames,
		};

		if (options.jsonEnvelope) {
			writeCompletionProfilesEnvelopeSuccess(
				jsonPayload,
				Date.now() - startedAtMs,
				traceId,
			);
			return;
		}

		if (options.json) {
			writeCompletionProfilesJsonLegacy(jsonPayload);
			return;
		}

		if (filteredNames.length === 0) {
			return;
		}

		const delimiter = options.delimiter ?? "\n";
		const payload = filteredNames.join(delimiter);
		const needsTrailingNewline = !payload.endsWith("\n");

		process.stdout.write(payload);
		if (needsTrailingNewline) {
			process.stdout.write("\n");
		}
	},
);

export default action;
