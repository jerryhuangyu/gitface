import process from "node:process";
import { ProfileService } from "@/core/profile-service";
import { withCommandHandling } from "../command-runner";

interface CompletionOptions {
	prefix?: string;
	delimiter?: string;
	limit?: string;
	json?: boolean;
}

type CompletionTopic = "profiles";

interface CompletionProfilesJsonOutput {
	topic: CompletionTopic;
	prefix: string | null;
	limit: number | null;
	count: number;
	names: string[];
}

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
		const normalizedTopic = topic.toLowerCase() as CompletionTopic;
		if (!["profiles"].includes(normalizedTopic)) {
			process.exitCode = 1;
			return;
		}

		const service = ProfileService.create();
		const names = await service.listProfileNames();
		const limit = parseLimit(options.limit);
		const filteredNames = filterByPrefix(names, options.prefix).slice(0, limit);

		if (options.json) {
			const payload: CompletionProfilesJsonOutput = {
				topic: normalizedTopic,
				prefix: options.prefix ?? null,
				limit: limit ?? null,
				count: filteredNames.length,
				names: filteredNames,
			};
			process.stdout.write(`${JSON.stringify(payload)}\n`);
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
