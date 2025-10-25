import { Command } from "commander";
import {
	currentIdentityCommand,
	editProfileCommand,
	listProfilesCommand,
	newProfileCommand,
	removeProfileCommand,
	useProfileCommand,
} from "@/commands";

function buildProgram(version: string): Command {
	const program = new Command();

	program
		.name("gitface")
		.description("A simple CLI tool to change your “face” in Git")
		.version(version);

	// Profile CRUD
	program.addCommand(newProfileCommand);
	program.addCommand(listProfilesCommand);
	program.addCommand(editProfileCommand);
	program.addCommand(removeProfileCommand);

	// Profile application
	program.addCommand(useProfileCommand);
	program.addCommand(currentIdentityCommand);

	program.showHelpAfterError("(use --help for usage information)");
	program.showSuggestionAfterError(true);

	return program;
}

export function runCLI(version: string): void {
	const program = buildProgram(version);
	program.parse();
}
