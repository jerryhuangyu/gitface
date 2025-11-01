import { Command } from "commander";
import type { CliCommand } from "../command";
import action from "./action";

export const command: Command = new Command("use")
	.description("Apply a stored profile to the active Git configuration")
	.argument("<profile>", "profile identifier")
	.option("-s, --scope <scope>", "local (default), global, or system", "local")
	.action(action);

const useProfileCommand: CliCommand = {
	command,
	action,
};

export default useProfileCommand;
