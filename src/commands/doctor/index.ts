import { Command } from "commander";
import type { CliCommand } from "../command";
import action from "./action";

const command: Command = new Command("doctor")
	.description("Check for common issues")
	.action(action);

const doctorCommand: CliCommand = {
	command,
	action,
};

export default doctorCommand;
