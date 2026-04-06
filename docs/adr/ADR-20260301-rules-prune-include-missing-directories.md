# ADR-20260301：擴充 `rules prune` 支援可選清理 missing directory 規則

## Context

GitFace 已提供 `rules doctor` 與 `rules prune`：

- `rules doctor` 可檢查兩類問題：
  - `profile` 不存在（`fail`）
  - `directory` 不存在（`warn`）
- `rules prune` 目前只會清理 `profile` 不存在的規則，對 `directory` 不存在的規則僅能人工 `rules remove`。

在規則數量成長與跨機器同步場景下，目錄被移除或重命名是常見事件。若 stale directory 規則長期殘留，會造成：

- `rules list` 雜訊增加，維運判讀成本上升。
- `rules doctor` 持續 `warn`，影響 CI gate 可用性（`--strict`）。
- 使用者需逐筆手動清理，流程不一致且易遺漏。

本輪 baseline（2026-03-01）：

- `pnpm run lint` 通過（0 問題）。
- `pnpm run test` 通過（`112 passed`，總耗時約 `4.98s`）。
- `pnpm run build` 通過（`dist/index.js 132.03 kB, gzip 25.89 kB`）。
- 現有 `rules prune` 測試僅覆蓋 missing profile，未覆蓋 missing directory 修復流程。

## Decision

在維持向後相容前提下，擴充 `gitface rules prune` 新增選項：

- `--include-missing-directory`

MVP 行為：

- 預設不變：僅清理 `profile` 不存在規則。
- 啟用 `--include-missing-directory` 後，額外把 `directory` 不存在的規則納入 prune 候選。
- 若同時 `profile` 與 `directory` 都不存在，標記為複合原因。
- `--dry-run` 與 `--json` 行為維持一致，僅擴充輸出欄位以描述 stale 原因：
  - `profileExists`
  - `directoryExists`
  - `staleReason`（`missing-profile` / `missing-directory` / `missing-profile-and-directory`）

此決策保留「預設安全」：不會在未明確指定時自動刪除缺失目錄規則，避免誤刪暫時不可達路徑（例如掛載點未掛載）。

## Alternatives Considered

1. 預設直接清理 missing directory（不加選項）

- 優點：操作更簡短。
- 缺點：風險高，可能誤刪暫時不可達目錄規則；違反最小驚訝原則。

2. 只強化 `rules doctor` 訊息，不提供修復

- 優點：零破壞、實作成本低。
- 缺點：維運仍需人工逐筆清理，無法腳本化修復。

3. 新增獨立命令 `rules prune-directories`

- 優點：語意清楚。
- 缺點：命令面膨脹，與既有 prune 功能高度重疊，學習成本增加。

## Consequences

正面：

- 將 `doctor` 可觀測問題與可執行修復對齊，降低規則腐化成本。
- 支援維運腳本先 `--dry-run --json` 再正式執行，流程可驗證可回放。
- 保留預設行為，舊腳本不受影響。

負面與風險：

- 增加 prune 輸出結構複雜度（多欄位原因）。
- 若使用者誤用 `--include-missing-directory` 可能刪除想保留的規則。

風險控制：

- 透過顯式旗標啟用，且建議先 dry-run。
- human/json 輸出均清楚標示 stale 原因，便於審核。

遷移與維護成本：

- 無資料格式遷移；僅命令選項與回報結構擴充。
- 需維護新增測試案例與文件說明。

## Rollout Plan

1. Phase 1（本輪 MVP）

- 新增 `--include-missing-directory` 選項。
- 擴充 prune 掃描與輸出欄位。
- 補齊 e2e 測試（dry-run/apply）與文件。

2. Phase 2（後續可選）

- 評估加入 `--strict`（發現候選即非零）供 CI 自動清理前 gate。
- 評估加入 `--only <reason>` 以支援更細緻清理策略。

3. 回滾策略

- 若新行為造成問題，可移除該選項並回退掃描邏輯；預設 prune 行為可完整保留。
- 已刪除規則可透過 `rules add` 重建。

## Test Plan

- E2E：
  - `rules prune --dry-run --include-missing-directory --json`：應回報 missing directory 候選，且不改動規則。
  - `rules prune --include-missing-directory --json`：應刪除 missing directory 規則並保留 healthy 規則。
  - 既有 missing profile 測試需持續通過（回歸）。
- 回歸：
  - 全量 `pnpm run test`。
  - `pnpm run lint`、`pnpm run build`。

## Observability

- Human output：每筆結果標示 `missing profile`、`missing directory` 或兩者。
- JSON output：提供 `summary` 與 `results[]`，每筆含 `staleReason/profileExists/directoryExists`。
- 主要觀測指標：
  - `summary.prunable`（待清理數）
  - `summary.pruned`（已清理數）
  - `summary.skipped`（清理失敗數）

## Security/Privacy

- 僅讀取本機檔案系統與 git global config，不引入網路傳輸。
- 不輸出敏感憑證；輸出資料限目錄路徑與 profile 名稱。
- 不提升權限、不修改與規則無關設定。

## Open Questions

- 是否需要加入白名單機制，避免特定目錄在 `--include-missing-directory` 下被清理？
- 是否應在 future 版提供互動式確認（非 JSON 模式）以降低誤刪風險？
