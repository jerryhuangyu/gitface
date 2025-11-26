import chalk from "chalk";
import { ProfileService } from "@/core/profile-service";
import { withCommandHandling } from "../command-runner";

interface Options {
	force?: boolean;
}

const action: (
	source: string,
	target: string,
	options: Options,
) => Promise<void> = withCommandHandling(
	"command:clone",
	async (source: string, target: string, options: Options) => {
		const service = ProfileService.create();
		const profile = await service.cloneProfile(source, target, options.force);

		console.log(
			`\n${chalk.green("✔")} Cloned profile '${source}' to '${profile.name}'.`,
		);
	},
);

export default action;
