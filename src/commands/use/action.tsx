import type { ConfigScope } from "@/core/git-service";
import { ProfileService } from "@/core/profile-service";
import { InvalidProfileError, ProfileNotFoundError } from "@/errors";
import { withCommandHandling } from "../command-runner";
import { buildProfileNotFoundReason } from "../profile-not-found-reason";
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
	const normalizedScope = (options.scope ?? "local").toLowerCase();
	if (!isValidScope(normalizedScope)) {
		const reason = "Scope must be one of: local, global, system.";
		if (options.json) {
			sendProfileUseFailedJson(reason);
		} else {
			sendProfileUseFailedMsg(reason);
		}
		process.exitCode = 1;
		return;
	}
	const scope = normalizedScope as ConfigScope;

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
		const scopedIdentity = await service.getScopedIdentity(scope);
		const currentIdentity = {
			gitName: scopedIdentity.gitName ?? null,
			email: scopedIdentity.email ?? null,
			signingKey: scopedIdentity.signingKey ?? null,
		};
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
		if (error instanceof ProfileNotFoundError) {
			const reason = await buildProfileNotFoundReason(
				profileName ?? error.profileName,
				error.message,
			);
			if (options.json) {
				sendProfileUseFailedJson(reason);
			} else {
				sendProfileUseFailedMsg(reason);
			}
			process.exitCode = 1;
			return;
		}

		if (options.json && error instanceof InvalidProfileError) {
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
