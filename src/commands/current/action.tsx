import { ProfileService } from "@/core/profile-service";
import { withCommandHandling } from "../command-runner";
import { sendCurrentIdentityMsg } from "./ui";

const action: () => Promise<void> = withCommandHandling(
	"command:current",
	async () => {
		const service = ProfileService.create();
		const identity = await service.getCurrentIdentity();

		sendCurrentIdentityMsg(identity);
	},
);

export default action;
