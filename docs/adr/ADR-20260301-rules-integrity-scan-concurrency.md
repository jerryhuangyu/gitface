# ADR-20260301：重構 `rules doctor/prune` 完整性掃描並加入可調式並行

## Context

`gitface rules doctor` 與 `gitface rules prune` 都需要對每條規則做完整性檢查（profile 是否存在、directory 是否存在）。目前實作存在三個痛點：

1. **重複邏輯**：doctor/prune 各自維護 profile 與 directory 檢查流程，修改風險高。
2. **可擴充性不足**：doctor 對 profile 檢查沒有快取；在大量規則共用少量 profile 時，會反覆讀取同一份 profile。
3. **效能可預測性不足**：目前為逐筆 await 掃描，規則量大時耗時增加明顯，且無法由使用者按環境調整並行度。

本輪 baseline（2026-03-01，本地）：

- `pnpm run typecheck` 通過（`real 1.02s`）
- `pnpm run lint` 通過（`real 0.40s`）
- `pnpm run test` 通過（`116 passed`，`real 5.89s`）
- `pnpm run build` 通過（`dist/index.js 133.71kB`，`real 1.42s`）

## Decision

實作一個共享的規則完整性掃描模組，讓 doctor/prune 共用同一份檢查結果，並新增可調整並行度的 CLI 參數。

MVP 決策如下：

- 新增共享掃描模組（供 doctor/prune 共用）。
- 掃描過程導入：
  - profile existence 快取（同名 profile 僅查一次）
  - directory existence 快取（同路徑僅 stat 一次）
  - 受控並行 worker（預設並行度 8）
- 新增參數：
  - `gitface rules doctor --concurrency <number>`
  - `gitface rules prune --concurrency <number>`
- 參數驗證：`concurrency` 必須為正整數，否則以錯誤結束並回傳 exit code `1`。
- 預設行為向後相容：不帶 `--concurrency` 時維持既有輸出語意與退出碼規則。

## Alternatives Considered

1. 維持現況（不重構、不同步優化）

- 優點：零風險、零改動。
- 缺點：重複邏輯持續累積；大量規則場景延展性差。

2. 僅在 prune 加快取，不調整 doctor

- 優點：改動較小。
- 缺點：兩個命令行為仍分岔，未解決重複邏輯與長期維護成本。

3. 直接無上限 `Promise.all` 全並行

- 優點：實作簡單、理論上最快。
- 缺點：在大型規則集會放大 I/O 壓力與記憶體尖峰，不利穩定性。

## Consequences

正面：

- 大量規則場景下，doctor/prune 的完整性掃描更快且更穩定。
- 共用掃描邏輯降低重複程式碼與回歸風險。
- 使用者可依 CI runner 或本機環境調整 `--concurrency`，改善可控性。

負面與風險：

- 增加一個命令參數，需補足文件與測試矩陣。
- 並行實作需避免非預期 race 或例外吞沒。

遷移與維護成本：

- 無資料遷移。
- 需維護 `concurrency` 參數驗證與共享掃描模組測試。

## Rollout Plan

1. Phase 1（本輪 MVP）

- 新增共享掃描模組，改寫 doctor/prune 使用同一套結果。
- 新增 `--concurrency` 參數與驗證。
- 補測試（共享掃描、doctor/prune 參數與回歸）。
- 更新 README/CLI 文件。

2. Phase 2（後續）

- 若未來規則量級更大，再評估自動並行度（依 CPU 核心/環境）或加入更細粒度診斷統計。

3. 回滾策略

- 若發生回歸，可直接 revert 本次 commit：doctor/prune 退回原先逐筆掃描流程，不影響資料格式。

## Test Plan

- 單元測試：
  - 共享掃描模組快取行為（重複 profile/directory 僅檢查一次）。
  - 並行掃描結果完整性（狀態與 staleReason 正確）。
- E2E / 回歸：
  - `rules doctor --json --concurrency <n>` 正常輸出。
  - `rules prune --dry-run --json --concurrency <n>` 正常輸出。
  - `--concurrency 0` 或非數字時回傳錯誤與 exit code `1`。
- 全量品質閘道：`pnpm run typecheck`、`pnpm run lint`、`pnpm run test`、`pnpm run build`。

## Observability

- 既有 `doctor/prune --json` 輸出維持可觀測欄位（`status/summary/results/strict`）。
- 透過 CLI 參數 `--concurrency` 讓維運可在 CI 中調整掃描策略。
- 關鍵觀測指標：
  - `doctor/prune` 命令耗時
  - `summary.prunable`、`summary.fail`、`summary.warn`

## Security/Privacy

- 僅操作本機檔案系統與 git config，無網路傳輸。
- 不引入額外敏感資訊輸出；輸出仍限 directory/profile 與健康狀態。
- 受控並行避免無上限 I/O 放大。

## Open Questions

- 是否需要在未來加入環境變數（例如 `GITFACE_RULES_CONCURRENCY`）作為預設值覆寫？
- 是否要在 JSON 中回傳實際使用的並行度以利追蹤效能差異？
