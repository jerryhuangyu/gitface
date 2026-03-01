# ADR-20260301：穩定化 E2E 測試，避免 process 全域狀態並行衝突

## Context

GitFace 的 E2E 測試大量使用同一個 Node process 內的全域狀態（`process.cwd()`、`process.env`、`process.argv`、`process.exitCode`）來模擬 CLI 執行環境。隨著測試數量增加，當測試檔並行執行時，這些全域狀態會互相干擾，造成不穩定與高成本排錯。

本輪 baseline（2026-03-01）：

- `pnpm run lint`：通過，`real 0.33s`。
- `pnpm run test`：失敗，`19 files / 131 tests` 中 `3` 個失敗；總耗時 `905.07s`。
- 失敗型態包含：
  1. `tests/rules.e2e.test.ts` 出現 timeout（`5000ms`）；
  2. 後續測試在 `finally` 還原 `cwd` 時遇到 `ENOENT`；
  3. `tests/use.e2e.test.ts` 出現 timeout。
- 單檔重跑（`rules.e2e` 與 `use.e2e`）可穩定通過，顯示問題主要發生在多檔並行時。
- `pnpm run build`：通過，`real 1.10s`（`dist/index.js 142.09 kB, gzip 27.84 kB`）。

痛點：

1. CI 可能出現偶發紅燈，降低交付信心。
2. timeout 導致回饋迴圈極慢（>15 分鐘），拖慢開發。
3. 問題根因偏向測試基礎設施，而非產品行為，需先恢復可預期的品質門檻。

## Decision

本輪先以 MVP 方式在 Vitest 設定中停用測試檔並行（`fileParallelism: false`），讓同一輪 test run 以單一序列執行所有檔案，避免 process 全域狀態競爭。

具體決策：

1. 在 `vitest.config.ts` 設定 `test.fileParallelism = false`。
2. 保持既有測試內容與 CLI 行為不變，先專注恢復測試穩定性。
3. 在 README 的 Development 區塊補充原因，避免後續誤調回並行模式。

## Alternatives Considered

1. 維持現況（保留檔案並行）

- 優點：理論上速度較快。
- 缺點：持續存在 flaky timeout 與交叉污染，CI 可靠性不足。

2. 全面重寫 E2E 為子程序執行（每個案例 `spawn` 真實 CLI）

- 優點：隔離度最高，可保留並行能力。
- 缺點：改動範圍大、成本高，非本輪 MVP 可安全完成範圍。

3. 僅針對少數失敗檔加 `sequential`

- 優點：理論上可保留部分並行效能。
- 缺點：目前全域狀態汙染是跨檔風險，局部修補容易遺漏。

## Consequences

正面：

- 測試結果可預期，降低 CI 偶發失敗。
- 明確切斷跨檔全域狀態競爭，排錯成本下降。

負面：

- 測試牆鐘時間可能增加（以穩定性換取速度）。

風險與遷移：

- 無資料遷移。
- 若未來測試規模再成長，需再投資更完整隔離策略（例如子程序化）。

## Rollout Plan

1. Phase 1（本輪）

- 更新 `vitest.config.ts` 關閉檔案並行。
- 跑 `lint`、`test`、`build` 驗證基線恢復。
- 更新 README 開發說明。

2. Phase 2（後續）

- 盤點高風險 E2E，逐步改為子程序驅動，為未來恢復並行做準備。

3. 回滾策略

- 單一 revert 本 ADR 對應 commit，移除 `fileParallelism: false` 即可。

## Test Plan

- 全量回歸：
  - `pnpm run lint`
  - `pnpm run test`
  - `pnpm run build`
- 驗收標準：
  - 測試不再出現前述 timeout / `cwd` 還原失敗。
  - 失敗率由「有 3 個確定失敗」降為「0 失敗」。

## Observability

- 以 CI 指標追蹤：
  - `test` workflow 失敗率（目標下降）。
  - timeout 次數（目標下降至 0）。
  - 平均測試耗時（可接受上升，但需可預期）。

## Security/Privacy

- 僅調整測試執行策略，不改變產品執行權限與資料流。
- 不新增外部連線、憑證或 PII 處理路徑。

## Open Questions

- 是否在下一輪導入「E2E 子程序 runner」，在維持隔離的前提下恢復部分並行？
- 是否需要把 process 全域狀態封裝為可注入 `ExecutionContext`，減少未來測試成本？
