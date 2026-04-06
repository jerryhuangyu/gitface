# ADR-20260301: `gitface use` 加入查詢式選擇與非 TTY 安全退化

## Context

`gitface use <profile>` 是 GitFace 的核心流程，但目前在「不帶 `<profile>`」時只有全量互動選單：

- profile 變多時，使用者需要在長清單內逐項移動，選擇成本高。
- 非 TTY（例如 pipe、CI、agent）情境下若未提供 `<profile>`，互動模式不可用，錯誤訊息不夠精準。
- 目前沒有用 `query` 直接縮小候選範圍的能力。

本輪 baseline（2026-03-01，本機）：

- `pnpm run typecheck` 通過，`real 0.85s`
- `pnpm run lint` 通過，`real 0.25s`
- `pnpm run test` 通過，`17 files / 105 tests`，`real 4.03s`
- `pnpm run build` 通過，`real 1.02s`
- Coverage：Statements `74.98%` / Branches `61.34%` / Functions `82.63%` / Lines `75.14%`
- Build 產物：`dist/index.js 121.79 kB (gzip 24.43 kB)`

## Decision

對 `gitface use` 增加 `--query`（`-q`）查詢能力，並重構互動選擇流程為「先解析候選，再決定是否互動」。

MVP 行為：

- 新增參數：`gitface use --query <text>`
- 當未提供 `<profile>` 時：
  - 先列出 profile 名稱並用 `query` 做不分大小寫子字串過濾。
  - 若候選為 0：明確回報「查無符合 query 的 profile」。
  - 若候選為 1：直接自動套用（不進互動）。
  - 若候選 > 1 且為 TTY：開啟互動選單，只顯示候選集。
  - 若候選 > 1 且非 TTY：明確失敗，要求提供明確 `<profile>`。
- 互動選單改為由外部注入候選資料，避免重複讀取 profile store。

## Alternatives Considered

1. 維持現狀，只保留 `gitface use` 互動選單

- 優點：零開發成本。
- 缺點：profile 多時 UX 差；非 TTY 不友善問題持續存在。

2. 新增獨立命令 `gitface pick` 專門做選擇

- 優點：職責分離清楚。
- 缺點：心智模型變複雜，核心操作被拆散；與既有 `use` 命令重疊。

3. 只做非 TTY 失敗保護，不新增 `--query`

- 優點：風險最低。
- 缺點：無法解決大量 profile 的操作效率問題，策略價值不足。

## Consequences

正面：

- profile 多時可快速縮小候選，提高切換效率。
- 非 TTY 流程行為可預期，錯誤訊息可直接引導修正。
- 減少互動流程中的重複 I/O，提升可維護性。

負面與成本：

- `use` 決策流程分支增加，需更多測試覆蓋。
- CLI 文件與使用者教學需同步更新。

遷移與回滾：

- 無資料遷移。
- 回滾策略：revert 本次 commit，恢復既有 `use` 行為。

## Rollout Plan

1. 新增 `use --query` 旗標與解析流程。
2. 重構互動選單為候選注入式 API。
3. 補 e2e 測試（單一 match 自動套用、多 match 非 TTY 失敗）。
4. 更新 README、`docs/cli.md`、`docs/user-manual.zh-TW.md`。
5. 跑 `pnpm run lint && pnpm run test && pnpm run build`。

## Test Plan

- 單元/邏輯：
  - query 正規化與大小寫不敏感過濾。
  - `0 / 1 / N` 候選分支的決策正確性。
- E2E：
  - `--query` 單一匹配可直接套用 profile。
  - `--query` 多匹配 + 非 TTY 會失敗並提示明確用法。
  - 既有互動模式與 JSON 模式行為不回歸。
- 回歸：
  - `gitface use <profile>`、`--dry-run`、`--json` 與 scope 行為維持既有契約。
- 效能：
  - 維持 O(N) 名稱掃描，不引入額外高階複雜度。

## Observability

可由既有 CLI log / exit code 觀測：

- `gitface_use_query_match_count`
- `gitface_use_query_ambiguous_non_tty_fail_count`
- `gitface_use_auto_select_count`
- `gitface_use_exit_code_nonzero_rate`

專案目前無內建 telemetry；先以測試、命令輸出與 exit code 作為主要觀測來源。

## Security/Privacy

- 僅讀取本機 profile store，不新增外部網路與權限需求。
- 不輸出 token/敏感資訊，錯誤訊息僅包含 profile 名稱與建議指令。

## Open Questions

- 是否要在後續加入「互動選單即時搜尋輸入」而非僅預先 query 過濾？
- 是否要提供 `--exact`（精確匹配）避免同名片段歧義？
