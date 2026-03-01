import { ProfileService } from "@/core/profile-service";
import { withCommandHandling } from "../command-runner";

interface ListOptions {
	json?: boolean;
	query?: string;
	limit?: string;
	sort?: string;
}

type SortMode = "updated" | "name";

const sortByUpdatedAtDesc = <T extends { updatedAt: string }>(
	items: T[],
): T[] =>
	[...items].sort(
		(a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
	);

const sortByNameAsc = <T extends { name: string }>(items: T[]): T[] =>
	[...items].sort((a, b) =>
		a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
	);

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

const parseSortMode = (value: string | undefined): SortMode => {
	if (value === undefined) {
		return "updated";
	}

	const normalized = value.trim().toLowerCase();
	if (normalized === "updated" || normalized === "name") {
		return normalized;
	}

	throw new Error("Sort mode must be one of: updated, name.");
};

const parseLimit = (value: string | undefined): number | undefined => {
	if (value === undefined) {
		return undefined;
	}

	const normalized = value.trim();
	if (!/^\d+$/.test(normalized)) {
		throw new Error("Limit must be a positive integer.");
	}

	const limit = Number.parseInt(normalized, 10);
	if (limit < 1) {
		throw new Error("Limit must be a positive integer.");
	}

	return limit;
};

const applyLimit = <T,>(items: T[], limit: number | undefined): T[] => {
	if (limit === undefined) {
		return items;
	}
	return items.slice(0, limit);
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
		const sortMode = parseSortMode(options.sort);
		const allProfiles = await service.listProfiles();
		const sorted =
			sortMode === "name"
				? sortByNameAsc(allProfiles)
				: sortByUpdatedAtDesc(allProfiles);
		const profiles = applyLimit(
			filterByNameQuery(sorted, options.query),
			parseLimit(options.limit),
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
