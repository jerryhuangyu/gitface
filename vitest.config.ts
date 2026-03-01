import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
		// E2E tests mutate process-global state (cwd/env/argv); run files serially
		// to avoid cross-file race conditions and flaky CI timeouts.
		fileParallelism: false,
		coverage: {
			reportOnFailure: true,
			reporter: ["text", "html", "clover", "json", "json-summary"],
		},
	},
});
