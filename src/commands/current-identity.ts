import { Command } from "commander";
import { withCommandHandling } from "@/commands/command-runner";
import { ProfileService } from "@/core/profile-service";

export const currentIdentityCommand: Command = new Command("current")
	.description("Show the Git identity currently configured in this repository")
	.action(
		withCommandHandling(async () => {
			const service = ProfileService.create();
			const identity = await service.getCurrentIdentity();

			console.log("👤 Current Git identity:\n");
			console.log(`   user.name     ${identity.gitName ?? "<unset>"}`);
			console.log(`   user.email    ${identity.email ?? "<unset>"}`);
			console.log(`   signingKey    ${identity.signingKey ?? "<unset>"}`);
		}),
	);
