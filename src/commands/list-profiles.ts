import { Command } from "commander";
import { withCommandHandling } from "@/commands/command-runner";
import { ProfileService } from "@/core/profile-service";

export const listProfilesCommand: Command = new Command("list")
	.alias("ls")
	.description("Display all stored Git profiles")
	.action(
		withCommandHandling(async () => {
			const service = ProfileService.create();
			const profiles = await service.listProfiles();

			if (profiles.length === 0) {
				console.log(
					"ℹ️  No saved profiles yet. Use 'gitface new <name>' to create one.",
				);
				return;
			}

			console.log("📁 Saved profiles:\n");
			console.table(
				profiles.map((profile) => ({
					profile: profile.name,
					"user.name": profile.gitName,
					"user.email": profile.email,
					signingKey: profile.signingKey ?? "<unset>",
					updatedAt: profile.updatedAt,
				})),
			);
		}),
	);
