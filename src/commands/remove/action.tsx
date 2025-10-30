import { ProfileService } from "@/core/profile-service";
import { ProfileNotFoundError } from "@/errors";
import { withCommandHandling } from "../command-runner";
import {
	sendProfileRemoveFailedMsg,
	sendProfileRemoveSuccessMsg,
	sendProfileRemoveWithForceMsg,
} from "./ui";

interface RemoveProfileOptions {
	force?: boolean;
}

const action: (name: string, options: RemoveProfileOptions) => Promise<void> =
	withCommandHandling(async (name, options) => {
		const service = ProfileService.create();

		try {
			const profile = await service.getProfile(name);
			await service.deleteProfile(name);
			sendProfileRemoveSuccessMsg(profile);
		} catch (error) {
			if (options.force && error instanceof ProfileNotFoundError) {
				sendProfileRemoveWithForceMsg(name);
				return;
			}
			if (error instanceof ProfileNotFoundError) {
				sendProfileRemoveFailedMsg(`'${name}' does not exist.`);
				return;
			}
			sendProfileRemoveFailedMsg(`Unexpected error ${JSON.stringify(error)}`);
		}
	});

export default action;
