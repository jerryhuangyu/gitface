import chalk from "chalk";
import { Text } from "ink";
import type React from "react";
import { Table } from "./table";

interface ProfileRow {
	name: string;
	gitName: string | null;
	email: string | null;
	signingKey?: string | null;
	updatedAt: string;
}

const timeAgo = (isoDate: string) => {
	const diff = Date.now() - new Date(isoDate).getTime();
	const sec = Math.floor(diff / 1000);
	const min = Math.floor(sec / 60);
	const hr = Math.floor(min / 60);
	const day = Math.floor(hr / 24);

	if (day > 0) return `${day} day${day > 1 ? "s" : ""} ago`;
	if (hr > 0) return `${hr} hour${hr > 1 ? "s" : ""} ago`;
	if (min > 0) return `${min} min ago`;
	return `Just now`;
};

const ProfilesList: React.FC<{ profiles: ProfileRow[] }> = ({ profiles }) => {
	if (profiles.length === 0) {
		return (
			<Text>
				{chalk.blue("ℹ️ No saved profiles yet.")}{" "}
				{chalk.dim(`Use 'gitface new <name>' to create one.`)}
			</Text>
		);
	}

	const rows = [...profiles]
		.sort(
			(a, b) =>
				new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
		)
		.map((p) => ({
			PROFILE: chalk.green(p.name),
			"GIT NAME": chalk.cyan(p.gitName ?? "<unset>"),
			EMAIL: chalk.yellow(p.email ?? "<unset>"),
			"SIGNING KEY": chalk.magenta(p.signingKey ?? "<none>"),
			UPDATED: chalk.dim(timeAgo(p.updatedAt)),
		}));

	return (
		<>
			<Text bold>📁 Saved Profiles:</Text>
			<Table data={rows} />
		</>
	);
};

export default ProfilesList;
