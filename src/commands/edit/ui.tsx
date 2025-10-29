import chalk from "chalk";
import { Box, Text, useApp } from "ink";
import SelectInput from "ink-select-input";
import TextInput from "ink-text-input";
import { useEffect, useState } from "react";
import { ProfileService } from "@/core/profile-service";
import { ProfileNotFoundError } from "@/errors";

interface Props {
	name: string;
	onSubmit: () => void;
}

const EditProfile: React.FC<Props> = ({ name, onSubmit }) => {
	const { exit } = useApp();
	const [isProfileFound, setIsProfileFound] = useState<boolean>(false);
	const [editingField, setEditingField] = useState<string | null>(null);
	const [draft, setDraft] = useState({
		gitName: "",
		email: "",
		signingKey: "",
		unsetSigningKey: false,
	});

	useEffect(() => {
		const fetchProfile = async () => {
			try {
				const service = ProfileService.create();
				const profile = await service.getProfile(name);

				if (!profile) {
					setIsProfileFound(false);
					return;
				}

				setIsProfileFound(true);
				setDraft({
					gitName: profile.gitName ?? "",
					email: profile.email ?? "",
					signingKey: profile.signingKey ?? "",
					unsetSigningKey: !profile.signingKey,
				});
			} catch (error) {
				if (error instanceof ProfileNotFoundError) {
					setIsProfileFound(false);
				}
			}
		};

		fetchProfile();
	}, [name]);

	const save = async () => {
		const service = ProfileService.create();
		const profile = await service.updateProfile(name, {
			gitName: draft.gitName,
			email: draft.email,
			signingKey: draft.unsetSigningKey ? null : draft.signingKey,
		});

		onSubmit();
		exit();
		sendProfileUpdateSuccessMsg(profile.name);
	};

	if (!isProfileFound) {
		return (
			<Text>Profile not found... Try `gitface list` to see all profiles.</Text>
		);
	}

	if (editingField) {
		return (
			<Box flexDirection="column" paddingTop={1}>
				<Text>Edit {editingField}:</Text>
				<TextInput
					// biome-ignore lint/suspicious/noExplicitAny: <generic>
					value={(draft as any)[editingField] ?? ""}
					onChange={(val) => setDraft({ ...draft, [editingField]: val })}
					onSubmit={() => setEditingField(null)}
				/>
			</Box>
		);
	}

	const fields = [
		{ label: `Git Name: ${draft.gitName}`, value: "gitName" },
		{ label: `Email: ${draft.email}`, value: "email" },
		{
			label: `Signing Key: ${draft.unsetSigningKey ? "(none)" : draft.signingKey}`,
			value: "signingKey",
		},
		{
			label: draft.unsetSigningKey ? "Enable Signing Key" : "Unset Signing Key",
			value: "toggleKey",
		},
		{ label: "✅ Save Changes", value: "save" },
		{ label: "❌ Cancel", value: "cancel" },
	];

	return (
		<Box flexDirection="column" paddingTop={1}>
			<Text bold>{`Editing profile: ${name}`}</Text>
			<Text>Select a field:</Text>

			<SelectInput
				items={fields}
				onSelect={({ value }) => {
					if (value === "toggleKey") {
						setDraft({ ...draft, unsetSigningKey: !draft.unsetSigningKey });
					} else if (value === "save") {
						save();
					} else if (value === "cancel") {
						exit();
					} else {
						setEditingField(value);
					}
				}}
			/>
		</Box>
	);
};

export default EditProfile;

export const sendProfileUpdateSuccessMsg: (profileName: string) => void = (
	profileName,
) => {
	console.log(`\n${chalk.green("✔")} Updated profile '${profileName}'.`);
};
