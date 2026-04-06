# ADR-20260301：為 `rules doctor/prune` 增加可觀測掃描指標

## Context

`gitface rules doctor` 與 `gitface rules prune` 已支援 `--concurrency`，但目前輸出仍缺少「本次實際掃描成本」資訊，造成兩個痛點：

1. **維運調優盲區**：CI 或大量規則環境下，只看到 pass/fail 與 prunable 數量，無法判斷該次掃描是否過慢。
2. **策略驗證成本高**：調整 `--concurrency` 後，缺乏結構化欄位可比對不同設定的效果。
3. **可回放性不足**：AI/自動化流程難以從 JSON 結果直接建立「耗時趨勢」觀測。

本輪 baseline（2026-03-01，本地）

- `pnpm lint`：通過，`real 0.27s`
- `pnpm test`：通過，`129 passed`，`real 7.23s`
- `pnpm build`：通過，`dist/index.js 137.27kB (gzip 27.08kB)`，`real 1.48s`
- 現況 JSON 僅提供 `summary/results`，沒有 `durationMs` 與 `concurrency` 實測值。

## Decision

在不破壞既有輸出語意與 exit code 規則前提下，為 `rules doctor/prune` 新增可觀測指標欄位，MVP 包含：

1. 在完整性掃描模組回傳 `metrics`：
   - `concurrency`
   - `scanned`
   - `uniqueProfilesChecked`
   - `uniqueDirectoriesChecked`
   - `scanDurationMs`
2. 在 `rules doctor --json` 與 `rules prune --json` 新增 `metrics` 欄位（向後相容的附加欄位）。
3. 在文字輸出模式增加一行 Scan Metrics 摘要，協助人類使用者快速判讀。
4. 補齊單元與 E2E 測試，確保欄位存在且數值合理（非負、正整數邊界）。

## Alternatives Considered

1. 維持現況（不新增 metrics）

- 優點：零改動。
- 缺點：無法量化掃描效能，CI 調參仍憑感覺。

2. 僅在 debug log 記錄耗時，不進 JSON

- 優點：程式改動小。
- 缺點：自動化流程難解析，無法穩定做機器比較與儀表板匯整。

3. 直接新增完整 telemetry/trace 系統

- 優點：可觀測能力最完整。
- 缺點：本輪範圍過大、引入額外依賴與隱私評估成本，不符合 MVP 範圍控制。

## Consequences

正面：

- `doctor/prune` 輸出可直接支援 CI 與 agent 做耗時監控與並行度調校。
- 有助於及早發現規則量成長造成的退化。
- 不改變既有欄位語意，向後相容風險低。

負面與風險：

- JSON payload 增加欄位，雖為向後相容，仍需確認消費端未做嚴格 schema 驗證。
- 耗時量測採 wall-clock，短任務可能受環境抖動影響。

遷移與維護成本：

- 無資料遷移。
- 後續需維護 metrics 欄位契約與測試。

## Rollout Plan

1. Phase 1（本輪）

- 擴充完整性掃描回傳結構。
- 將 metrics 注入 doctor/prune 的 JSON 與文字輸出。
- 更新 README/CLI 文件與測試。

2. Phase 2（後續）

- 視使用情況決定是否加入 p95/p99 追蹤指引與建議 `--concurrency` 區間。

3. 回滾策略

- 若出現相容性問題，可 revert 本次 commit，回到原先無 metrics 輸出。

## Test Plan

- 單元測試：
  - `scanRuleIntegrity` 回傳 records + metrics。
  - 驗證快取下的 `uniqueProfilesChecked/uniqueDirectoriesChecked` 計數。
- E2E：
  - `rules doctor --json` 應包含 `metrics` 欄位。
  - `rules prune --dry-run --json` 與 `rules prune --json` 應包含 `metrics` 欄位。
  - 保持既有 strict / error exit code 規則。
- 全量品質檢查：`pnpm lint`、`pnpm test`、`pnpm build`。

## Observability

新增關鍵指標（輸出即觀測來源）：

- `metrics.scanDurationMs`
- `metrics.concurrency`
- `metrics.scanned`
- `metrics.uniqueProfilesChecked`
- `metrics.uniqueDirectoriesChecked`

建議至少追蹤：

- 同資料量下不同 `concurrency` 的 `scanDurationMs` 變化
- 規則總量（`summary.scanned`）與耗時趨勢

## Security/Privacy

- 只增加本機運行統計，不新增網路傳輸。
- 不輸出 token、email 以外新增敏感資訊；metrics 僅為掃描數量與耗時。
- 不變更權限模型與檔案存取範圍。

## Open Questions

- 後續是否要在 `doctor/prune` 再加入 `totalDurationMs`（含非掃描步驟）供端到端比較？
- 是否需要在文件中提供不同規則量級的建議並行度預設值？
