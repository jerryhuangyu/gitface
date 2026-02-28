import { defineConfig } from "tsdown";

export default defineConfig({
	dts: true,
	outputOptions: {
		inlineDynamicImports: true,
	},
});
