import type { ConfigScope } from "@/core/git-service";
import { GitService } from "@/core/git-service";
import { ProfileService } from "@/core/profile-service";
import { InvalidProfileError, ProfileNotFoundError } from "@/errors";
import { withCommandHandling } from "../command-runner";
import {
	buildUseChangePlan,
	getEffectiveChanges,
	sendProfileUseDryRunJson,
	sendProfileUseDryRunMsg,
	sendProfileUseFailedJson,
	sendProfileUseFailedMsg,
	sendProfileUseNoopJson,
	sendProfileUseNoopMsg,
	sendProfileUseSuccessJson,
	sendProfileUseSuccessMsg,
} from "./output";

interface UseProfileOptions {
	scope?: string;
	dryRun?: boolean;
	json?: boolean;
}

export type PromptForProfileSelection = () => Promise<string | null>;

export const runUseAction = async (
	name: string | undefined,
	options: UseProfileOptions,
	promptForSelection: PromptForProfileSelection = promptForProfileSelection,
): Promise<void> => {
	const scope = (options.scope ?? "local").toLowerCase();
	if (!isValidScope(scope)) {
		const reason = "Scope must be one of: local, global, system.";
		if (options.json) {
			sendProfileUseFailedJson(reason);
		} else {
			sendProfileUseFailedMsg(reason);
		}
		process.exitCode = 1;
		return;
	}

	let profileName = name;
	if (options.json && !profileName) {
		sendProfileUseFailedJson(
			"Profile name is required when using --json output mode.",
		);
		process.exitCode = 1;
		return;
	}

	if (!profileName) {
		profileName = (await promptForSelection()) ?? undefined;
		if (!profileName) {
			sendProfileUseFailedMsg(
				"No profiles found. Run `gitface new <name>` to create one first.",
			);
			process.exitCode = 1;
			return;
		}
	}

	try {
		const service = ProfileService.create();
		const profile = await service.getProfile(profileName);
		const currentIdentity = await getScopedIdentity(scope);
		const plan = buildUseChangePlan(profile, currentIdentity);
		const effectiveChanges = getEffectiveChanges(plan);

		if (options.dryRun) {
			if (options.json) {
				sendProfileUseDryRunJson(profile, scope, currentIdentity);
				return;
			}

			sendProfileUseDryRunMsg(profile, scope, currentIdentity);
			return;
		}

		if (effectiveChanges.length === 0) {
			if (options.json) {
				sendProfileUseNoopJson(profile, scope);
				return;
			}
			sendProfileUseNoopMsg(profile, scope);
			return;
		}

		await service.applyProfile(profileName, scope);

		if (options.json) {
			sendProfileUseSuccessJson(profile, scope);
			return;
		}

		sendProfileUseSuccessMsg(profile, scope);
	} catch (error) {
		if (
			options.json &&
			(error instanceof ProfileNotFoundError ||
				error instanceof InvalidProfileError)
		) {
			sendProfileUseFailedJson(error.message);
			process.exitCode = 1;
			return;
		}
		throw error;
	}
};

const action: (
	name: string | undefined,
	options: UseProfileOptions,
) => Promise<void> = withCommandHandling("command:use", runUseAction);

export default action;

export const promptForProfileSelection: PromptForProfileSelection =
	async () => {
		const [{ render }, { SelectProfile }] = await Promise.all([
			import("ink"),
			import("./select-profile"),
		]);

		return await new Promise<string | null>((resolve) => {
			render(
				<SelectProfile
					onSelect={(selected) => {
						resolve(selected);
					}}
					onEmpty={() => {
						resolve(null);
					}}
				/>,
			);
		});
	};

function isValidScope(value: string): value is ConfigScope {
	const VALID_SCOPES = new Set<ConfigScope>(["local", "global", "system"]);
	return VALID_SCOPES.has(value as ConfigScope);
}

async function getScopedIdentity(scope: ConfigScope): Promise<{
	gitName: string | null;
	email: string | null;
	signingKey: string | null;
}> {
	const gitService = new GitService();
	const [gitName, email, signingKey] = await Promise.all([
		gitService.getConfig("user.name", scope),
		gitService.getConfig("user.email", scope),
		gitService.getConfig("user.signingkey", scope),
	]);

	return {
		gitName,
		email,
		signingKey,
	};
}
