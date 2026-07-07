// @ts-check
import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";

export default defineConfig({
	site: "https://jerryhuangyu.github.io",
	base: "/gitface",
	integrations: [
		starlight({
			title: "GitFace",
			description: "一條命令，讓每個 repo 用對 Git 身分。",
			defaultLocale: "root",
			locales: {
				root: { label: "繁體中文", lang: "zh-TW" },
			},
			social: [
				{
					icon: "github",
					label: "GitHub",
					href: "https://github.com/jerryhuangyu/gitface",
				},
			],
			sidebar: [
				{
					label: "入門",
					items: [{ label: "總覽與快速上手", slug: "overview" }],
				},
				{
					label: "功能說明",
					items: [
						{ label: "Profiles 生命週期", slug: "profiles" },
						{ label: "套用與檢查", slug: "apply" },
						{ label: "Folder Rules", slug: "rules" },
					],
				},
				{
					label: "CI 與腳本",
					items: [{ label: "JSON 與自動化", slug: "automation" }],
				},
				{
					label: "深入",
					items: [{ label: "架構與開發", slug: "architecture" }],
				},
			],
			customCss: ["./src/styles/custom.css"],
		}),
	],
});
