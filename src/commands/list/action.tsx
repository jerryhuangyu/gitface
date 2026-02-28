import { ProfileService } from "@/core/profile-service";
import { withCommandHandling } from "../command-runner";

interface ListOptions {
	json?: boolean;
	query?: string;
}

const sortByUpdatedAtDesc = <T extends { updatedAt: string }>(
	items: T[],
): T[] => {
	return [...items].sort(
		(a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
	);
};

const filterByNameQuery = <T extends { name: string }>(
	items: T[],
	query: string | undefined,
): T[] => {
	const normalized = query?.trim().toLowerCase();
	if (!normalized) {
		return items;
	}

	return items.filter((item) => item.name.toLowerCase().includes(normalized));
};

const printPlainProfiles = <
	T extends {
		name: string;
		gitName: string | null;
		email: string | null;
		signingKey?: string | null;
		updatedAt: string;
	},
>(
	profiles: T[],
	query: string | undefined,
): void => {
	if (profiles.length === 0) {
		if (query?.trim()) {
			console.log(`No profiles matched query "${query.trim()}".`);
			return;
		}
		console.log(
			"No saved profiles yet. Use 'gitface new <name>' to create one.",
		);
		return;
	}

	console.log("Saved Profiles:");
	for (const profile of profiles) {
		console.log(
			`- ${profile.name}: ${profile.gitName ?? "<unset>"} <${profile.email ?? "<unset>"}> signingKey=${profile.signingKey ?? "<none>"} updatedAt=${profile.updatedAt}`,
		);
	}
};

const action: (options: ListOptions) => Promise<void> = withCommandHandling(
	"command:list",
	async (options) => {
		const service = ProfileService.create();
		const profiles = filterByNameQuery(
			sortByUpdatedAtDesc(await service.listProfiles()),
			options.query,
		);

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

		if (!process.stdout.isTTY) {
			printPlainProfiles(
				profiles.map((profile) => profile.snapshot()),
				options.query,
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
