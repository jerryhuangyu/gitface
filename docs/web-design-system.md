# GitFace 文件站設計系統（as-built）

文件站（`web/`）以 Astro Starlight 為底座，移植 Cloudflare Developer Docs
（developers.cloudflare.com，同為 Starlight）的設計語言與元件化工程。**唯一
刻意偏離**：品牌 accent 維持 GitFace 綠（Cloudflare 為橘）。

## 架構分層

```
web/src/
├─ styles/
│  ├─ global.css        # Tailwind v4 entry + 設計 token（unlayered :root）
│  └─ starlight.css     # Starlight chrome / 內容樣式 override（unlayered）
├─ components/
│  ├─ StructuralGrid.astro   # 點陣背景裝飾層
│  ├─ CommandBlock.astro     # 可複製指令區塊
│  ├─ FeatureCard.astro      # CF 式功能卡片（整卡可點）
│  └─ overrides/             # 取代 Starlight 內建 chrome
│     ├─ Hero.astro
│     ├─ Header.astro
│     └─ Footer.astro
└─ content.config.ts   # 擴充 frontmatter：eyebrow / command
```

### 建置層：Tailwind v4

- `tailwindcss@4` + `@tailwindcss/vite`（astro.config `vite.plugins`）
  + `@astrojs/starlight-tailwind@5`（橋接 Starlight 色票到 Tailwind）。
- Tailwind utilities 可供 MDX 作者使用。

### token 為何 unlayered

設計 token 定義在 `global.css` 的**未分層** `:root`，不放進 `@theme`：

1. **永遠勝出**：Starlight 把預設變數放在 `@layer starlight.base`（見
   `props.css`）；未分層規則永遠贏過任何 `@layer`，故灰階 / accent / 字體
   覆寫穩定生效。
2. **避免 tree-shake**：Tailwind v4 的 `@theme` 只會輸出「被 utility 引用到」
   的變數；元件用 `var(--token)` 取值不算引用，放 `@theme` 會被 tree-shake
   掉導致取不到值。

## 設計 token

| 類別 | 說明 |
| --- | --- |
| 中性灰階 | Cloudflare 純中性 ramp（去掉 Starlight 預設偏藍） |
| `--sl-color-accent` | GitFace 綠 `#1f7a4f`（品牌，不採 CF 橘） |
| `--color-cl1-*` | Cloudflare 語意色票（aside / badge 引用） |
| 版面 | 內容 45rem（有 TOC）/ 67.5rem（無 TOC）、側欄 18.75rem、TOC 18rem |
| 字體 | Inter（`@fontsource-variable/inter`，自架離線） |

## 元件

### Override chrome（自動套用，無需 import）

- **Hero** — eyebrow + 大標 + tagline + CTA + 點陣背景 + 可複製安裝指令
  chip。讀 frontmatter `eyebrow` / `command` / `hero.*`。
- **Header** — Starlight 三欄 grid + 右側實心綠 CTA。
- **Footer** — Starlight footer + 品牌頁尾列。

### 內容元件（在 MDX import 使用）

```mdx
import CommandBlock from "../../components/CommandBlock.astro";
import FeatureCard from "../../components/FeatureCard.astro";

<CommandBlock command="gitface use work" />

<FeatureCard title="Folder Rules" icon="setting" href="/gitface/rules/">
  資料夾規則讓 repo 依所在位置自動用對身分。
</FeatureCard>
```

`icon` 用 Starlight 內建 icon 名；`href` 給了整卡可點。

### 直接用 Starlight 內建（已套 CF 樣式，勿重造）

`Steps`、`Badge`（pill 造型）、`LinkButton`、`LinkCard`（hover 抬升）、
`CardGrid`、`Card`、`Tabs`。

## 已移植 vs 刻意未移植

**已移植**：中性灰階、cl1 色票、8px 版面節奏、Inter、大寫 static 側欄分組
標題、sticky TOC、扁平 aside、pill badge、圓角條紋表格、無邊框 pagination、
override chrome、CommandBlock / FeatureCard。

**刻意未移植**：

- Cloudflare 橘（保留 GitFace 綠）。
- CF 落地頁行銷版面（`StructuralGrid` 完整版 / `TabBar` / `ChangelogSection`
  等）綁定其專屬元件與產品內容，對單一 CLI 工具是過度工程。
- CF 的 100+ 產品導向元件（API schema 產生器、產品目錄、diagram 等）。
