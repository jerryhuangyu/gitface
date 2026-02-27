import { Command } from "commander";
import type { CliCommand } from "../command";
import action from "./action";

const command: Command = new Command("doctor")
	.description("Check for common issues")
	.option("--json", "Output doctor report as JSON")
	.action(action);

const doctorCommand: CliCommand = {
	command,
	action,
};

export default doctorCommand;
