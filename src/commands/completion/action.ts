import process from "node:process";
import { ProfileService } from "@/core/profile-service";
import { withCommandHandling } from "../command-runner";

interface CompletionOptions {
	prefix?: string;
	delimiter?: string;
}

type CompletionTopic = "profiles";

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
		const profiles = await service.listProfiles();
		const names = profiles.map((profile) => profile.name);

		const filteredNames =
			options.prefix === undefined
				? names
				: names.filter((name) => name.startsWith(options.prefix as string));

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
