import { render } from "ink";
import { withCommandHandling } from "../command-runner";
import CurrentIdentity from "./ui";

const action: () => Promise<void> = withCommandHandling(async () => {
	const instance = render(<CurrentIdentity />);
	await instance.waitUntilExit();
});

export default action;
