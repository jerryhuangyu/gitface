# ADR-20260301：新增 `rules prune` 以清理失效規則（Missing Profile）

## Context

GitFace 近期已提供 `rules resolve/apply/doctor`，但目前對「壞規則」的修復仍需人工完成：

- `rules doctor` 可檢測到 `profileExists=false` 的規則，但不提供一鍵修復。
- `rules apply` 在命中不存在的 profile 時會失敗，影響自動化與日常切換穩定性。
- 規則數量增加後，人工逐筆 `rules remove` 成本高且容易遺漏。

本輪 baseline（2026-03-01）觀察：

- 測試：`110 passed`，但 `tests/rules.e2e.test.ts` 執行時間約 `3.1s`，顯示 rules 相關場景已成為核心流程之一。
- 覆蓋率：`src/commands/rules` 分支覆蓋率偏低（約 `44.48%`），高風險區域需要更可驗收的流程化維運功能。
- 使用情境：當 profile 被 rename/remove 或跨機器同步不完整時，global include 規則容易殘留，造成 apply/resolve 體驗不穩。

## Decision

新增 `gitface rules prune` 子命令，用來清理「指向不存在 profile」的 folder rules。

MVP 行為（本輪範圍）：

- 掃描所有 folder rules。
- 找出 `profileExists=false` 的規則作為 prune 候選。
- 支援 `--dry-run`：只回報候選，不改動 git global config。
- 支援 `--json`：輸出可機器讀取結果，包含總數與候選清單。
- 非 dry-run 會逐筆移除候選規則，並回報 `scanned/prunable/pruned/skipped` 摘要。
- 若 global config 不存在（新環境），視為 0 規則，不報錯。

命令介面：

- `gitface rules prune`
- `gitface rules prune --dry-run`
- `gitface rules prune --json`
- `gitface rules prune --dry-run --json`

## Alternatives Considered

1. 在 `rules doctor` 增加 `--fix`

- 優點：命令較少，學習成本低。
- 缺點：檢測與修復語意混在同一命令，輸出責任變複雜，`doctor --strict` 與 `--fix` 的交互規則容易混淆。

2. 只提供文件指引（手動 `rules list` + `rules remove`）

- 優點：零開發成本。
- 缺點：無法規模化處理、容易漏刪，且難以在 CI/腳本中穩定重現。

3. 直接在 `rules apply` 自動移除壞規則

- 優點：看似自動修復。
- 缺點：隱式副作用過大，違反最小驚訝原則；單次 apply 不應改寫全域規則集合。

## Consequences

正面：

- 降低 `rules apply` 因壞規則造成的失敗率。
- 提供可腳本化的維運入口（`--json` + `--dry-run`）。
- 將「檢測」與「修復」拆分，指令語意更清楚。

負面與風險：

- 使用者可能誤解 prune 範圍（以為會處理 directory 缺失）。
- 非 dry-run 會改動 global git config，需明確輸出與可回滾路徑。

風險控制：

- 預設先掃描再摘要，`--dry-run` 可先驗證。
- 僅刪除 `profileExists=false`，不處理 directory 缺失，避免過度修復。

遷移與維護成本：

- 無資料格式遷移；僅新增命令與輸出函式。
- 長期可擴展到 `--include-missing-directories` 等策略化清理。

## Rollout Plan

1. Phase 1（本輪）

- 上線 `rules prune` MVP（missing profile only）。
- 提供 human/json + dry-run。
- 補齊 e2e 測試與文件。

2. Phase 2（後續）

- 評估加入選項化策略：
  - `--include-missing-directories`
  - `--strict`（有候選即非零退出，用於 CI）

3. 回滾策略

- 若行為有問題，可回退該命令實作，不影響既有 `rules add/remove/resolve/apply/doctor`。
- 規則刪除屬可重建狀態，可透過 `rules add` 逐筆恢復。

## Test Plan

- 單元/整合：以既有 e2e 風格驗證命令端到端。
- E2E 最小集：
  - `--dry-run --json` 應列出 prunable 規則且不改動 global config。
  - 實際 prune 應刪除失效規則並保留健康規則。
  - 無規則/無 global config 情況應返回空摘要且成功。
- 回歸：執行全量 `pnpm run test` 確保既有 rules 行為不回歸。

## Observability

- Human 模式：輸出掃描摘要與每筆候選（dry-run）/已刪除（execute）。
- JSON 模式：統一輸出摘要欄位：
  - `status`
  - `dryRun`
  - `summary.scanned/prunable/pruned/skipped`
  - `results[]`（含 directory/profileName/profileExists）
- 透過 CI 測試與 json snapshot-like assertions 觀察行為穩定性。

## Security/Privacy

- 僅讀寫本機 git global config 與本機 profile store，不新增外部網路傳輸。
- 不記錄或輸出 token/PII；輸出內容限制在目錄路徑與 profile 名稱。
- 維持最小權限：不觸碰與規則無關的 git key。

## Open Questions

- 是否需要在下一版支援「directory 不存在」的可選清理策略？
- 是否需要 `--strict` 讓 prune 在發現候選時可作為 CI gate？
