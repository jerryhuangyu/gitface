import chalk from "chalk";
import type { Profile } from "@/core/profile";
import { Box, Text, useApp } from "ink";
import { useEffect, useState } from "react";
import { ProfileService } from "@/core/profile-service";
import SelectInput from "ink-select-input";

const infoIcon = chalk.blue("ℹ");
const checkIcon = chalk.greenBright("✔");
const crossIcon = chalk.redBright("✖");

export const sendProfileUseSuccessMsg = (
	profile: Profile,
	scope: string,
): void => {
	const name = chalk.green(`'${profile.name}'`);
	const gitName = profile.gitName;
	const email = profile.email;
	const signingKey = profile.signingKey ?? chalk.dim("<unset>");
	const profileScope = chalk.green(scope);

	console.log();
	console.log(`${infoIcon} ${chalk.dim("user.name")}  ${gitName}`);
	console.log(`${infoIcon} ${chalk.dim("user.email")}  ${email}`);
	console.log(`${infoIcon} ${chalk.dim("signingKey")}  ${signingKey}`);
	console.log();
	console.log(
		`${checkIcon} Used profile ${name} to ${profileScope} Git config.`,
	);
};

export const sendProfileUseFailedMsg = (reason: string): void => {
	console.log();
	console.log(`${crossIcon} Profile use failed: ${chalk.red(reason)}`);
};

interface Props {
	onSelect: (profileName: string) => void;
}

export const SelectProfile: React.FC<Props> = ({ onSelect }) => {
	const { exit } = useApp();
	const [items, setItems] = useState<Array<{ label: string; value: string }>>(
		[],
	);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const fetchProfiles = async () => {
			const service = ProfileService.create();
			const profiles = await service.listProfiles();
			setItems(
				profiles.map((p) => ({
					label: p.name,
					value: p.name,
				})),
			);
			setLoading(false);
		};
		fetchProfiles();
	}, []);

	if (loading) {
		return <Text>Loading profiles...</Text>;
	}

	if (items.length === 0) {
		return (
			<Box flexDirection="column">
				<Text color="yellow">No profiles found.</Text>
				<Text>Run `gitface new` to create one.</Text>
			</Box>
		);
	}

	return (
		<Box flexDirection="column">
			<Text bold>Select a profile to use:</Text>
			<SelectInput
				items={items}
				onSelect={(item) => {
					onSelect(item.value);
					exit();
				}}
			/>
		</Box>
	);
};