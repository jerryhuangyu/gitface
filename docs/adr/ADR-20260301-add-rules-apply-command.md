# ADR-20260301: 新增 `gitface rules apply` 以一鍵套用目錄規則

## Context

GitFace 已支援 `rules add/remove/list/resolve`，可把資料夾對應到 profile，並可透過 `rules resolve` 檢查命中規則。但目前使用者要真正切換身分仍需兩步：

1. `gitface rules resolve [directory]`
2. `gitface use <profile> [--scope ...]`

這在日常開發、CI 腳本與 AI agent 自動流程中帶來痛點：

- 操作流程分裂，使用者需要手動取出命中 profile 再執行 `use`。
- 腳本實作成本高，需自行處理 unmatched / missing profile / dry-run / strict gate。
- 規則存在的核心價值（「按目錄快速切換」）沒有完整落地在單一命令體驗。

本輪 baseline（2026-03-01，本機）：

- `pnpm lint`：通過，`real 0.39s`
- `pnpm test`：通過，`17 files / 98 tests`，`real 3.69s`
- `pnpm build`：通過，`real 1.59s`
- 覆蓋率：Statements `76.93%`、Branches `64.15%`、Functions `84.96%`、Lines `77.14%`
- 產物大小：`dist/index.js 110.30 kB (gzip 22.65 kB)`

## Decision

新增子命令：`gitface rules apply [directory]`，直接以「目錄規則解析結果」套用 profile 到指定 scope，提供一致的互動與 JSON 自動化契約。

### 1) CLI 介面

- `gitface rules apply [directory]`
- 選項：
  - `--scope <local|global|system>`（預設 `local`）
  - `--dry-run`（僅預覽，不寫入 Git config）
  - `--json`（輸出機器可讀結果）
  - `--strict`（`unmatched` 視為失敗，exit code `1`）

### 2) 行為語意

- `matched`：找到規則且 profile 存在
  - 正式模式：套用 profile，回報 `status: "applied"`
  - `--dry-run`：回傳 change plan，`status: "dry-run"`
  - 若已無變更，回傳 `status: "unchanged"`
- `unmatched`：沒有規則命中
  - 預設 exit code `0`
  - `--strict` 設為 exit code `1`
- 命中規則但 profile 不存在：視為錯誤，exit code `1`

### 3) 向後相容

- 不改動既有 `rules resolve` 與 `use` 契約。
- `rules apply` 為新增能力，既有腳本不受影響。

## Alternatives Considered

1. 不新增命令，要求使用者持續用 `resolve + use`

- 優點：零開發成本
- 缺點：高頻流程冗長、容易誤操作、腳本重複邏輯

2. 在 `gitface use` 新增 `--from-rules`

- 優點：命令數少
- 缺點：`use` 已承載互動選擇/JSON/dry-run，語意變複雜；目錄規則邏輯與 `rules` 領域耦合更高

3. 新增 `rules resolve --apply` 旗標

- 優點：沿用現有命令
- 缺點：`resolve` 從查詢命令變成可寫入命令，職責混淆；文件與心智模型不清楚

## Consequences

正面：

- 將「目錄規則」從查詢提升為可直接執行的操作路徑，降低切換成本。
- CI/agent 可直接用單一命令完成「解析 + 套用/驗證」。
- 可重用既有 `use` 的 change-plan 與 scope 邏輯，維持輸出一致性。

負面與風險：

- 新命令增加維護面（文件、測試、輸出契約）。
- 若 `--scope global/system` 使用不當，可能放大影響範圍（以既有 scope 驗證與 dry-run 降風險）。

遷移與回滾：

- 無資料遷移。
- 回滾可直接移除 `rules apply` 與相關文件/測試，revert commit 即可。

## Rollout Plan

1. 新增 `rules apply` 命令定義與 action。
2. 實作 matched / unmatched / strict / dry-run / json 行為。
3. 補 e2e（成功套用、dry-run、不命中 strict、JSON 契約）。
4. 更新 README、`docs/cli.md`、`docs/user-manual.zh-TW.md`。
5. 跑 `lint/test/build` 驗證。
6. 若回歸，revert 本次 commit。

## Test Plan

- e2e：
  - `rules apply` 命中規則後可寫入 local git config。
  - `rules apply --dry-run --json` 提供可解析的變更計畫且不寫入。
  - `rules apply --strict --json` 在 `unmatched` 場景回傳 `status: "unmatched"` 且 exit code `1`。
  - 命中不存在 profile 時回傳錯誤（JSON 與 exit code `1`）。
- 回歸：既有 `rules resolve`/`use`/`rules add/remove/list` 行為不變。
- 品質閘道：`pnpm lint`、`pnpm test`、`pnpm build`。

## Observability

關鍵指標：

- `rules apply --json` 的 `status` 分佈（`applied/unchanged/dry-run/unmatched/error`）
- `--strict` 模式失敗率
- dry-run `hasChanges` 比例（評估規則命中後實際變更率）

目前無集中 telemetry，先以 CLI JSON 與 exit code 作為可觀測面，供 CI/agent 收集。

## Security/Privacy

- 不新增外部網路存取。
- 僅操作既有 Git config scope；預設維持 `local` 最小影響面。
- JSON 輸出不新增敏感欄位，沿用既有 profile 基本資訊與變更鍵名。

## Open Questions

- 後續是否要加入 `rules apply --all`，批次巡檢多個 repo 並輸出彙總？
- 是否需要在 `rules list` 顯示最近一次 `apply` 結果（需額外狀態儲存）？
