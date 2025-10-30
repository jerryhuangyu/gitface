import chalk from "chalk";
import { Box, Text, useApp } from "ink";
import TextInput from "ink-text-input";
import { useReducer, useState } from "react";
import { z } from "zod";
import type { Profile } from "@/core/profile";
import { ProfileService } from "@/core/profile-service";

interface Props {
	name: string;
	defaultGitName?: string;
	defaultEmail?: string;
	defaultSigningKey?: string | null;
}

const gitNameSchema = z.string().min(1, "Name is required");
const emailSchema = z
	.string()
	.min(1, "Email is required")
	.pipe(z.email("Invalid email format"));
const signingKeySchema = z.string().optional();

type Field = "gitName" | "email" | "signingKey";

interface FormState {
	values: {
		gitName: string;
		email: string;
		signingKey: string;
	};
	error: string | null;
}

type Action =
	| { type: "UPDATE_FIELD"; field: Field; value: string }
	| { type: "SET_ERROR"; error: string | null }
	| { type: "RESET_ERROR" };

const formReducer = (state: FormState, action: Action): FormState => {
	switch (action.type) {
		case "UPDATE_FIELD":
			return {
				...state,
				values: {
					...state.values,
					[action.field]: action.value,
				},
				error: null, // auto-clear error when typing
			};
		case "SET_ERROR":
			return { ...state, error: action.error };
		default:
			return state;
	}
};

const CreateProfile: React.FC<Props> = ({
	name,
	defaultGitName,
	defaultEmail,
	defaultSigningKey,
}) => {
	const { exit } = useApp();
	const [step, setStep] = useState(0);

	const [state, dispatch] = useReducer(formReducer, {
		values: {
			gitName: defaultGitName ?? "",
			email: defaultEmail ?? "",
			signingKey: defaultSigningKey ?? "",
		},
		error: null,
	});

	const validateStep = () => {
		const validators = [
			() => gitNameSchema.safeParse(state.values.gitName.trim()),
			() => emailSchema.safeParse(state.values.email.trim()),
			() => signingKeySchema.safeParse(state.values.signingKey.trim()),
		];
		const result = validators[step]();
		if (!result.success) {
			return result.error.issues[0]?.message ?? "Invalid input";
		}
		return null;
	};

	const handleSubmit = async () => {
		try {
			const service = ProfileService.create();
			const profile = await service.createProfile({
				name,
				gitName: state.values.gitName.trim(),
				email: state.values.email.trim(),
				signingKey: state.values.signingKey.trim() || null,
				force: true,
			});

			exit();
			sendProfileCreateSuccessMsg(profile);
		} catch (error) {
			console.error("Failed to create profile:", error);
		}
	};

	const goNext = async () => {
		const validationError = validateStep();
		if (validationError) {
			dispatch({ type: "SET_ERROR", error: validationError });
			return;
		}

		if (step < questions.length - 1) {
			setStep(step + 1);
		} else {
			await handleSubmit();
		}
	};

	const questions = [
		{
			label: "Git user.name",
			field: "gitName" as Field,
			value: state.values.gitName,
		},
		{
			label: "Git user.email",
			field: "email" as Field,
			value: state.values.email,
		},
		{
			label: "Signing key (optional)",
			field: "signingKey" as Field,
			value: state.values.signingKey,
		},
	];

	const current = questions[step];

	return (
		<Box flexDirection="column" padding={1}>
			<Text bold>Create Profile: {name}</Text>

			<Box marginTop={1}>
				<Text>{current.label}: </Text>
				<TextInput
					value={current.value}
					onChange={(value) =>
						dispatch({ type: "UPDATE_FIELD", field: current.field, value })
					}
					onSubmit={goNext}
				/>
			</Box>

			{state.error && (
				<Box marginTop={1}>
					<Text color="red">❌ {state.error}</Text>
				</Box>
			)}

			<Box marginTop={1}>
				<Text dimColor>
					Press Enter to continue ({step + 1}/{questions.length})
				</Text>
			</Box>
		</Box>
	);
};

export default CreateProfile;

export const sendProfileCreateSuccessMsg = (profile: Profile): void => {
	const name = profile.name;
	const gitName = profile.gitName;
	const email = profile.email;
	const signingKey = profile.signingKey ?? chalk.dim("<unset>");

	const infoIcon = chalk.blue("ℹ");
	const checkIcon = chalk.greenBright("✔");

	console.log(`${infoIcon} ${chalk.dim("user.name")}  ${gitName}`);
	console.log(`${infoIcon} ${chalk.dim("user.email")}  ${email}`);
	console.log(`${infoIcon} ${chalk.dim("signingKey")}  ${signingKey}`);
	console.log();
	console.log(`${checkIcon} Saved profile ${chalk.green(`'${name}'`)}`);
};
