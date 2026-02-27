import { ProfileService } from "@/core/profile-service";
import { withCommandHandling } from "../command-runner";
import { sendCurrentIdentityJson, sendCurrentIdentityMsg } from "./ui";

interface CurrentOptions {
	json?: boolean;
}

const action: (options: CurrentOptions) => Promise<void> = withCommandHandling(
	"command:current",
	async (options) => {
		const service = ProfileService.create();
		const identity = await service.getCurrentIdentity();

		if (options.json) {
			sendCurrentIdentityJson(identity);
			return;
		}

		sendCurrentIdentityMsg(identity);
	},
);

export default action;
