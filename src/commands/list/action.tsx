import { render } from "ink";
import { ProfileService } from "@/core/profile-service";
import { withCommandHandling } from "../command-runner";
import ProfilesList from "./ui";

const action: () => Promise<void> = withCommandHandling(
	"command:list",
	async () => {
		const service = ProfileService.create();
		const profiles = await service.listProfiles();

		const instance = render(<ProfilesList profiles={profiles} />);
		await instance.waitUntilExit();
	},
);

export default action;
