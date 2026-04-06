import { defineConfig } from "tsdown";

export default defineConfig({
	dts: true,
	outputOptions: {
		codeSplitting: false,
	},
});
