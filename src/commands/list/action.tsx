import { ProfileService } from "@/core/profile-service";
import { withCommandHandling } from "../command-runner";

interface ListOptions {
	json?: boolean;
}

const sortByUpdatedAtDesc = <T extends { updatedAt: string }>(
	items: T[],
): T[] => {
	return [...items].sort(
		(a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
	);
};

const action: (options: ListOptions) => Promise<void> = withCommandHandling(
	"command:list",
	async (options) => {
		const service = ProfileService.create();
		const profiles = sortByUpdatedAtDesc(await service.listProfiles());

		if (options.json) {
			console.log(
				JSON.stringify(
					profiles.map((profile) => profile.snapshot()),
					null,
					2,
				),
			);
			return;
		}

		const [{ render }, { default: ProfilesList }] = await Promise.all([
			import("ink"),
			import("./ui"),
		]);
		const instance = render(<ProfilesList profiles={profiles} />);
		await instance.waitUntilExit();
	},
);

export default action;
