import { Command } from "commander";
import { ProfileService } from "../core/profile-service";
import { withCommandHandling } from "./command-runner";

interface UseProfileOptions {
	scope?: string;
}

const VALID_SCOPES = new Set(["local", "global", "system"]);

export const useProfileCommand = new Command("use")
	.description("Apply a stored profile to the active Git configuration")
	.argument("<profile>", "profile identifier")
	.option("-s, --scope <scope>", "local (default), global, or system", "local")
	.action(
		withCommandHandling(async (name: string, options: UseProfileOptions) => {
			const scope = (options.scope ?? "local").toLowerCase();
			if (!VALID_SCOPES.has(scope)) {
				throw new Error("Scope must be one of: local, global, system.");
			}

			const service = ProfileService.create();
			const profile = await service.useProfile(
				name,
				scope as "local" | "global" | "system",
			);
			console.log(
				`✅ Applied profile '${profile.name}' to ${scope} Git config.`,
			);
		}),
	);
