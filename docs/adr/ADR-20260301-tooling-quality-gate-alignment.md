# ADR-20260301：對齊工具鏈品質閘門設定（Biome + tsdown）

## Context

GitFace 近期功能迭代速度快，但本輪 baseline（2026-03-01）顯示工具鏈設定出現漂移，影響品質閘門可信度與維護效率：

- `pnpm run lint`：通過但出現 1 則設定資訊，`biome.json` schema 為 `2.3.7`，CLI 為 `2.4.4`（建議 migrate），耗時 `real 1.11s`。
- `pnpm run typecheck`：通過，`real 0.89s`。
- `pnpm run test`：通過（`19 files / 131 tests`），耗時 `real 14.45s`，coverage `73.46%`。
- `pnpm run build`：通過，`real 1.14s`，但有 deprecation warning：`inlineDynamicImports option is deprecated, please use codeSplitting: false instead.`

另外，`biome.json` 的 includes 目前為 `["src/**/*.ts", "src/**/*.tsx", "test/**/*.ts"]`，實際測試目錄為 `tests/`，代表測試檔未被 Biome 納入核心規則範圍，會讓品質閘門產生「看似綠燈但覆蓋不完整」的風險。

痛點總結：

1. 品質閘門訊號不乾淨（lint/build 有警訊但不 fail）。
2. 測試程式碼靜態檢查覆蓋缺口，長期可能累積可維護性風險。
3. 工具鏈 deprecation 若持續累積，後續升級成本會提高。

## Decision

本輪採用中等成本、低風險的工具鏈對齊 MVP，強化品質閘門一致性：

1. 更新 `biome.json` schema 至目前專案使用的 Biome CLI 版本（`2.4.4`）。
2. 修正 Biome includes 路徑：由 `test/**/*.ts` 改為 `tests/**/*.ts`，確保測試檔納入 lint。
3. 更新 `tsdown.config.ts`，以 `codeSplitting: false` 取代已棄用的 `inlineDynamicImports: true`，消除 build deprecation warning。
4. 更新 README Development 說明，讓維護者明確知道品質閘門覆蓋範圍與建置策略。

## Alternatives Considered

1. 維持現況，暫不處理

- 優點：零實作成本。
- 缺點：設定漂移持續，警訊噪音與覆蓋缺口會累積，未來升級風險更高。

2. 只更新 schema 與 deprecation，不擴大 tests lint 覆蓋

- 優點：改動最小，立即消除大部分 warning。
- 缺點：無法解決測試檔未受 lint 管控的核心品質缺口。

3. 導入更嚴格的新工具或自訂檢查腳本（例如額外 CI job）

- 優點：可建立更完整品質策略。
- 缺點：本輪範圍過大，導入與維運成本高，不符合 MVP 節奏。

## Consequences

正面：

- `lint` 與 `build` 訊號更乾淨，CI 噪音下降。
- 測試程式碼納入 Biome 檢查，提升一致性與可維護性。
- 提前消除 deprecation 風險，降低未來工具升級成本。

負面：

- 測試檔納入 lint 後，可能揭露既有格式/規則問題，短期需額外修正。
- 設定同步需要持續維護，避免再次漂移。

風險與遷移：

- 無資料遷移；僅工具設定調整。
- 風險可透過完整 `lint/typecheck/test/build` 回歸控制。

## Rollout Plan

1. Phase 1（本輪 MVP）

- 更新 `biome.json` schema 與 includes。
- 更新 `tsdown.config.ts` 移除 deprecated option。
- 補充 README Development 說明。
- 執行 `pnpm run lint && pnpm run typecheck && pnpm run test && pnpm run build` 驗證。

2. Phase 2（後續演進）

- 若 tests lint 發現 recurring pattern，可補 shared Biome 規則與自動修復流程。
- 評估是否在 CI 增加「無 warning build」硬性 gate（若工具支持）。

3. 回滾策略

- 單一 revert 本 commit 可回到舊設定。
- 回滾後仍可維持功能正確性，不影響使用者資料。

## Test Plan

- 單元/整合/E2E 回歸：
  - `pnpm run lint`
  - `pnpm run typecheck`
  - `pnpm run test`
  - `pnpm run build`
- 驗收標準：
  - lint 不再出現 schema mismatch 訊息。
  - build 不再出現 `inlineDynamicImports` deprecation warning。
  - 全部測試維持通過，行為無回歸。

## Observability

關鍵可觀測指標（以 CI log 為主）：

1. lint 訊息中的 schema mismatch 次數（目標：`1 -> 0`）。
2. build deprecation warning 次數（目標：`1 -> 0`）。
3. 測試總數與通過數（目標：維持 `131/131`）。
4. 主要指令耗時變化（lint/test/build）作為效能回歸觀察。

## Security/Privacy

- 本決策僅涉及本地工具設定與建置選項，無新增權限、網路傳輸或敏感資料處理路徑。
- 不改變 GitFace 使用者資料模型與儲存內容。

## Open Questions

1. 是否要在 CI 強制「零 warning」政策（lint/build）以防設定漂移再次發生？
2. 是否要把工具鏈版本與 schema 對齊檢查自動化（例如 pre-commit 或 lint 前置檢查）？
