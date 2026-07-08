import { docsLoader } from "@astrojs/starlight/loaders";
import { docsSchema } from "@astrojs/starlight/schema";
import { defineCollection, z } from "astro:content";

export const collections = {
	docs: defineCollection({
		loader: docsLoader(),
		// 擴充 frontmatter：讓自製 Hero 支援 eyebrow 與可複製的安裝指令
		schema: docsSchema({
			extend: z.object({
				eyebrow: z.string().optional(),
				command: z.string().optional(),
			}),
		}),
	}),
};
