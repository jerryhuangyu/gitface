import os from "node:os";
import path from "node:path";

interface OSPaths {
	home(): string | undefined;
	config(appName?: string): string | undefined;
}

const platform = process.platform;
const isWindows = /^win/i.test(platform);

function normalizePath(value: string | null | undefined): string | undefined {
	if (!value) return undefined;

	return path.normalize(path.join(value, "."));
}

function resolveFromOS(): string | undefined {
	if (typeof os.homedir === "function") {
		return normalizePath(os.homedir());
	}

	return undefined;
}

function resolveWindowsHome(): string | undefined {
	const env = process.env;
	const candidates: Array<string | undefined> = [
		env.USERPROFILE,
		env.HOME,
		env.HOMEDRIVE && env.HOMEPATH
			? path.join(env.HOMEDRIVE, env.HOMEPATH)
			: undefined,
	];

	for (const candidate of candidates) {
		const normalized = normalizePath(candidate);
		if (normalized) {
			return normalized;
		}
	}

	return undefined;
}

function resolvePosixHome(): string | undefined {
	return normalizePath(process.env.HOME);
}

function home(): string | undefined {
	const fromOS = resolveFromOS();
	if (fromOS) {
		return fromOS;
	}

	if (isWindows) {
		return resolveWindowsHome();
	}

	return resolvePosixHome();
}

function resolveWindowsConfigRoot(): string | undefined {
	const appDataPath = process.env.APPDATA;
	if (appDataPath) return normalizePath(appDataPath);

	const homeDir = home();
	if (!homeDir) return undefined;

	return path.join(homeDir, "AppData", "Roaming");
}

function resolvePosixConfigRoot(): string | undefined {
	const xdgRoot = process.env.XDG_CONFIG_HOME;
	if (xdgRoot) return normalizePath(xdgRoot);

	const homeDir = home();
	if (!homeDir) return undefined;

	return path.join(homeDir, ".config");
}

function config(appName: string): string | undefined {
	let base: string | undefined;

	if (isWindows) base = resolveWindowsConfigRoot();
	else base = resolvePosixConfigRoot();

	if (!base) return undefined;

	return path.join(base, appName);
}

const osPaths: OSPaths = {
	home,
	config,
};

function createOSPaths(): OSPaths {
	return osPaths;
}

export type { OSPaths };
export { createOSPaths, osPaths };
