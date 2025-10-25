import { Command } from "commander";
import { withCommandHandling } from "@/commands/command-runner";
import { ProfileService } from "@/core/profile-service";

interface EditProfileOptions {
	gitName?: string;
	email?: string;
	signingKey?: string;
	unsetSigningKey?: boolean;
}

export const editProfileCommand: Command = new Command("edit")
	.description("Update the stored details for an existing Git profile")
	.argument("<profile>", "profile identifier")
	.option("-n, --git-name <value>", "New Git user.name value")
	.option("-e, --email <value>", "New Git user.email value")
	.option("-s, --signing-key <value>", "New Git signing key value")
	.option("--unset-signing-key", "Remove the stored signing key")
	.action(
		withCommandHandling(async (name: string, options: EditProfileOptions) => {
			if (!hasUpdates(options)) {
				throw new Error(
					"Specify at least one field to update (see --help for details).",
				);
			}

			const service = ProfileService.create();
			const profile = await service.updateProfile(name, {
				gitName: options.gitName,
				email: options.email,
				signingKey: options.unsetSigningKey ? null : options.signingKey,
			});

			console.log(`✏️  Updated profile '${profile.name}'.`);
		}),
	);

function hasUpdates(options: EditProfileOptions): boolean {
	return Boolean(
		options.gitName ||
			options.email ||
			options.signingKey ||
			options.unsetSigningKey,
	);
}
