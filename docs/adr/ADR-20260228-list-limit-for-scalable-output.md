# ADR-20260228: 為 `gitface list` 增加 `--limit` 以改善大規模輸出體驗

## Context

`gitface list` 目前雖然已支援 `--query` 與非 TTY 純文字輸出，但在 profile 數量較多（例如 50+）時，仍會一次輸出全部資料：

- 人類閱讀成本高：終端機噪音大，難以快速定位最新或關鍵 profile。
- 腳本與 CI 成本高：日誌過長、下游工具 parsing 成本上升。
- 使用者期望落差：`rules list` 已有 `--limit`，但 `list` 沒有，CLI 體驗不一致。

本輪可量測 baseline（2026-02-28，本機 sandbox）：

- 已掃描：repo 結構、README、`docs/cli.md`、既有 ADR、最近 commits、CI workflow 設定。
- 無法直接讀取雲端 issue/PR 與遠端 CI 即時結果（sandbox 網路限制）。
- `pnpm -s lint`：通過，`real 0.23s`
- `pnpm -s test`：通過，`17 files / 73 tests`，`real 3.22s`
- `pnpm -s build`：通過，`real 0.86s`，`dist/index.js 93.16 kB (gzip 20.00 kB)`
- 覆蓋率：Statements `78.5%`、Branches `63.83%`、Functions `87.2%`、Lines `78.82%`

## Decision

實作一個向後相容的 MVP：

1. 在 `gitface list` 新增 `--limit <number>` 參數。
2. 套用順序固定為：`sort(updatedAt desc)` → `query filter` → `limit`。
3. `--limit` 僅接受正整數（`>= 1`）；非法值會回報明確錯誤並以 exit code `1` 結束。
4. JSON 與 human/non-TTY 輸出都套用相同限制邏輯。
5. 預設（未帶 `--limit`）行為不變，確保向後相容。

## Alternatives Considered

1. 不做變更，維持現況
- 優點：零實作成本。
- 缺點：大量資料場景下 UX 與效能體感持續不佳。

2. 改做分頁（pagination）而非 limit
- 優點：可完整瀏覽大資料。
- 缺點：CLI 參數與狀態管理更複雜，超出本輪 MVP 範圍。

3. 只在 TTY 介面做互動式縮減（例如 lazy render）
- 優點：人類使用體驗可改善。
- 缺點：對 CI/腳本（非 TTY）幾乎無幫助，無法解決日誌膨脹。

## Consequences

正面：

- 大量 profile 時可顯著降低輸出量與閱讀成本。
- CLI 行為一致性提升（`list` 與 `rules list` 都支援 `--limit`）。
- 改動小且獨立，維護成本低。

負面 / 風險：

- 新增參數後需維護輸入驗證與錯誤訊息。
- 可能有使用者誤以為 `--limit` 會影響排序（實際上不影響）。

遷移與回滾：

- 無資料遷移需求。
- 若回歸問題出現，可單一 commit 回滾（移除 `--limit` 與相關測試/文件）。

## Rollout Plan

1. 擴充 `list` command options（Commander）加入 `--limit`。
2. 在 `list` action 新增 `limit` 驗證與套用函式。
3. 新增 e2e 測試：
- `--json --limit` 正常截斷
- 無效 `--limit` 會設置 exit code `1`
4. 更新文件：`README.md`、`docs/cli.md`。
5. 執行 quality gate：`lint/test/build`。

Feature flag / 回滾策略：

- 不需 feature flag（屬 additive 參數）。
- 回滾方式為 revert 本次 commit。

## Test Plan

- 單元/整合：
- 以 action 層 helper 驗證 `--limit` 解析與切片行為。

- E2E：
- `gitface list --json --limit 1` 只回傳 1 筆（維持 updatedAt desc）。
- `gitface list --query <q> --limit 1` 套用順序正確。
- `gitface list --limit 0` / 非整數時，輸出錯誤並 exit code `1`。

- 回歸：
- 原本 `list --json`、`list --query`、非 TTY 輸出測試持續通過。

- 效能：
- 用 limit 場景確認輸出列數下降（作為體驗與處理成本 proxy 指標）。

## Observability

目前專案無集中式 telemetry，採以下可觀測信號：

- 測試中驗證輸出筆數與 exit code。
- 手動比對 `list` 在大量 profiles 下的輸出行數（有無 `--limit`）。
- 透過 CI 測試避免行為回歸。

## Security/Privacy

- 只處理本地 profile 資料，無新增網路 I/O。
- 無新增權限、token、PII 外送風險。
- `--limit` 僅為輸出控制，不改動資料面。

## Open Questions

- 未來 `list --json` 是否需要像 `import/export` 一樣回傳 metadata（例如 `total`、`returned`）以利腳本觀測？
- `--limit` 是否需要支援 `0` 表示「不輸出內容，只驗證資料可讀」的特例模式？
