---
title: 架構與開發
description: 原始碼分層、本地開發指令和技術組成，給想貢獻程式或深入理解實作的人。
---

GitFace 把 CLI 介面和 core service 分層。Commander 負責 command shape，Ink
提供互動式 terminal UI，core services 封裝 profile、Git config、rules、
匯入匯出和 Result Envelope。這讓互動模式、非互動模式和測試可以共用行為。

## 主要目錄與責任

以下是目前 repo 的功能切面，適合新 contributor 先讀。

| 路徑 | 責任 |
| --- | --- |
| `src/cli/index.ts` | 建立 Commander program，掛載所有 command，預設 action 是 current identity。 |
| `src/commands/` | 每個 command 拆成 `index`、`action`、`ui`、`output`，讓 UI 和核心邏輯分離。 |
| `src/core/` | Profile、Git、rules、completion、import/export、rename/remove 等 service 層。 |
| `src/domain/` | `Profile` 和 `Rule` domain model，集中驗證與資料 shape。 |
| `src/infra/` | OS path、profile config store、atomic write、logger 等環境邊界。 |
| `tests/` | Vitest unit tests 和 e2e tests，包含 profile、rules、completion、Git service 和 CLI behavior。 |

## 本地開發指令

### Install dependencies

```sh
pnpm install
```

使用 repo 指定的 pnpm 版本安裝依賴。

### Typecheck and bundle

```sh
pnpm build
```

先跑 `tsc --noEmit`，再用 `tsdown` 輸出 `dist/`。

### Watch build

```sh
pnpm dev
```

用 `tsdown --watch` 在開發時持續重建 CLI bundle。

### Test suite

```sh
pnpm test
```

執行 Vitest、silent output 和 V8 coverage。

### Lint

```sh
pnpm lint
```

用 Biome 檢查格式與 lint 規則。

### Typecheck only

```sh
pnpm typecheck
```

只跑 TypeScript 型別檢查，適合快速驗證 command/service 改動。

## 專案技術組成

- **CLI**：Commander、chalk、simple-git
- **TTY UI**：Ink、React、ink-text-input、ink-select-input
- **Quality**：TypeScript、Vitest、Biome、tsdown
