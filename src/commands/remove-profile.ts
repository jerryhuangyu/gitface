import { Command } from "commander";
import { ProfileService } from "../core/profile-service";
import { withCommandHandling } from "./command-runner";

interface RemoveProfileOptions {
	force?: boolean;
}

export const removeProfileCommand = new Command("rm")
	.alias("remove")
	.description("Delete a stored Git profile")
	.argument("<profile>", "profile identifier")
	.option("-f, --force", "Ignore missing profile errors")
	.action(
		withCommandHandling(async (name: string, options: RemoveProfileOptions) => {
			const service = ProfileService.create();
			try {
				await service.deleteProfile(name);
				console.log(`🗑️  Removed profile '${name}'.`);
			} catch (error) {
				if (options.force && error instanceof Error) {
					console.log(`Profile '${name}' does not exist. Nothing to do.`);
					return;
				}
				throw error;
			}
		}),
	);
