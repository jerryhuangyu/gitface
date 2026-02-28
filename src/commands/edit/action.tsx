import { ProfileService } from "@/core/profile-service";
import { InvalidProfileError, ProfileNotFoundError } from "@/errors";
import { withCommandHandling } from "../command-runner";
import {
	sendProfileUpdateFailedJson,
	sendProfileUpdateSuccessJson,
	sendProfileUpdateSuccessMsg,
} from "./output";

interface EditProfileOptions {
	gitName?: string;
	email?: string;
	signingKey?: string;
	unsetSigningKey?: boolean;
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
				const profile = await service.updateProfile(name, {
					gitName: options.gitName,
					email: options.email,
					signingKey: options.unsetSigningKey ? null : options.signingKey,
				});

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
					sendProfileUpdateFailedJson(name, error.message);
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
