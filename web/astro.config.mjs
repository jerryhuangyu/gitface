// @ts-check
import starlight from "@astrojs/starlight";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
	site: "https://jerryhuangyu.github.io",
	base: "/gitface",
	// Tailwind v4 走 Vite plugin（對齊 Cloudflare docs 的建置層）
	vite: {
		plugins: [tailwindcss()],
	},
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
			// 自製元件系統：override Starlight 內建 chrome
			components: {
				Hero: "./src/components/overrides/Hero.astro",
				Header: "./src/components/overrides/Header.astro",
				Footer: "./src/components/overrides/Footer.astro",
			},
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
			customCss: [
				// 字體：Inter（自架、離線可用）
				"@fontsource-variable/inter",
				// Tailwind v4 entry + design tokens（@theme）
				"./src/styles/global.css",
				// Starlight chrome / 內容樣式 override
				"./src/styles/starlight.css",
			],
		}),
	],
});
