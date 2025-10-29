import { Box, Text } from "ink";
import { useEffect, useState } from "react";
import { ProfileService } from "@/core/profile-service";

const CurrentIdentity: React.FC = () => {
	const [identity, setIdentity] = useState<{
		gitName?: string;
		email?: string;
		signingKey?: string;
	} | null>(null);

	useEffect(() => {
		const fetchIdentity = async () => {
			const service = ProfileService.create();
			const result = await service.getCurrentIdentity();
			setIdentity(result);
		};
		fetchIdentity();
	}, []);

	if (!identity) {
		return <Text color="yellow">Loading Git identity…</Text>;
	}

	return (
		<Box flexDirection="column" gap={0} paddingTop={1}>
			<Text bold color="magenta">
				Current Git identity:
			</Text>

			<Box>
				<Box width={14} marginLeft={2}>
					<Text dimColor>user.name</Text>
				</Box>
				<Text>{identity.gitName ?? "<unset>"}</Text>
			</Box>

			<Box>
				<Box width={14} marginLeft={2}>
					<Text dimColor>user.email</Text>
				</Box>
				<Text>{identity.email ?? "<unset>"}</Text>
			</Box>

			<Box display={identity.signingKey ? "flex" : "none"}>
				<Box width={14} marginLeft={2}>
					<Text dimColor>signingKey</Text>
				</Box>
				<Text>{identity.signingKey ?? "<unset>"}</Text>
			</Box>
		</Box>
	);
};

export default CurrentIdentity;
