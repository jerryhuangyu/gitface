import { ProfileService } from "@/core/profile-service";
import { InvalidProfileError, ProfileNotFoundError } from "@/errors";
import { withCommandHandling } from "../command-runner";
import { buildProfileNotFoundReason } from "../profile-not-found-reason";
import {
	sendProfileUpdateDryRunJson,
	sendProfileUpdateDryRunMsg,
	sendProfileUpdateFailedJson,
	sendProfileUpdateSuccessJson,
	sendProfileUpdateSuccessMsg,
} from "./output";

interface EditProfileOptions {
	gitName?: string;
	email?: string;
	signingKey?: string;
	unsetSigningKey?: boolean;
	dryRun?: boolean;
	json?: boolean;
}

const action: (name: string, options: EditProfileOptions) => Promise<void> =
	withCommandHandling("command:edit", async (name, options) => {
		if (options.json && !hasUpdates(options)) {
			sendProfileUpdateFailedJson(
				name,
				"Non-interactive flags are required when using --json output mode.",
			);
			process.exitCode = 1;
			return;
		}

		if (hasUpdates(options)) {
			const service = ProfileService.create();
			try {
				const update = {
					gitName: options.gitName,
					email: options.email,
					signingKey: options.unsetSigningKey ? null : options.signingKey,
				};
				if (options.dryRun) {
					const plan = await service.planUpdateProfile(name, update);
					if (options.json) {
						sendProfileUpdateDryRunJson(plan.profile);
						return;
					}
					sendProfileUpdateDryRunMsg(plan.profile.name);
					return;
				}
				const profile = await service.updateProfile(name, update);

				if (options.json) {
					sendProfileUpdateSuccessJson(profile);
					return;
				}
				sendProfileUpdateSuccessMsg(profile.name);
			} catch (error) {
				if (
					options.json &&
					(error instanceof ProfileNotFoundError ||
						error instanceof InvalidProfileError)
				) {
					const reason =
						error instanceof ProfileNotFoundError
							? await buildProfileNotFoundReason(name, error.message)
							: error.message;
					sendProfileUpdateFailedJson(name, reason);
					process.exitCode = 1;
					return;
				}
				throw error;
			}
			return;
		}

		const [{ render }, { default: EditProfile }] = await Promise.all([
			import("ink"),
			import("./ui"),
		]);
		const instance = render(<EditProfile name={name} onSubmit={() => {}} />);
		await instance.waitUntilExit();
	});

export default action;

function hasUpdates(options: EditProfileOptions): boolean {
	return Boolean(
		options.gitName ||
			options.email ||
			options.signingKey ||
			options.unsetSigningKey,
	);
}
