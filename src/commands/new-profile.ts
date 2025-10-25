import { Command } from "commander";
import { withCommandHandling } from "@/commands/command-runner";
import { ProfileService } from "@/core/profile-service";

interface NewProfileOptions {
	gitName?: string;
	email?: string;
	signingKey?: string;
	force?: boolean;
}

export const newProfileCommand: Command = new Command("new")
	.description("Create a profile from the current Git config or passed options")
	.argument("<profile>", "profile identifier")
	.option("-n, --git-name <value>", "Git user.name value to store")
	.option("-e, --email <value>", "Git user.email value to store")
	.option("-s, --signing-key <value>", "Git signing key value to store")
	.option("-f, --force", "Overwrite an existing profile")
	.action(
		withCommandHandling(async (name: string, options: NewProfileOptions) => {
			const service = ProfileService.create();
			const profile = await service.createProfile({
				name,
				gitName: options.gitName,
				email: options.email,
				signingKey: options.signingKey ?? null,
				force: Boolean(options.force),
			});

			console.log(`✅ Saved profile '${profile.name}'.`);
			console.log(`   user.name     ${profile.gitName}`);
			console.log(`   user.email    ${profile.email}`);
			console.log(`   signingKey    ${profile.signingKey ?? "<unset>"}`);
		}),
	);
