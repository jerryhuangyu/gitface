import { Box, Text, useApp } from "ink";
import SelectInput from "ink-select-input";
import { useEffect, useState } from "react";
import { ProfileService } from "@/core/profile-service";

interface Props {
	onSelect: (profileName: string) => void;
	onEmpty?: () => void;
}

export const SelectProfile: React.FC<Props> = ({ onSelect, onEmpty }) => {
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

	useEffect(() => {
		if (!loading && items.length === 0) {
			onEmpty?.();
			exit();
		}
	}, [exit, items.length, loading, onEmpty]);

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
