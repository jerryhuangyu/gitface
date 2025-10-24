import { type SimpleGit, type SimpleGitOptions, simpleGit } from "simple-git";

// * Default options for simple-git
// baseDir: process.cwd(),
// binary: "git",
// maxConcurrentProcesses: 6,
// trimmed: false,

const options: Partial<SimpleGitOptions> = {
	baseDir: process.cwd(),
	binary: "git",
	maxConcurrentProcesses: 6,
	trimmed: false,
};

// when setting all options in a single object
const git: SimpleGit = simpleGit(options);

export { git };
