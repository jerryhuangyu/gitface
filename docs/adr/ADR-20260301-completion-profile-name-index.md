# ADR-20260301: 將 completion profiles 改為檔名索引路徑以提升韌性與效能

## Context

`gitface completion profiles` 目前透過 `ProfileService.listProfiles()` 取得候選名稱。  
該路徑會讀取並解析所有 profile JSON 檔，即使補全只需要 `name`。

這帶來兩個痛點：

1. 在 profile 數量成長時，tab 補全每次都觸發大量檔案讀取與 JSON 解析，互動延遲增加。
2. 若任一無關 profile 檔 JSON 損壞，completion 可能整體失敗，影響高頻核心流程的可用性。

本輪 baseline（2026-03-01，本機）：

- `pnpm -s run lint`：pass，`real 0.40s`
- `pnpm -s run typecheck`：pass，`real 0.95s`
- `pnpm -s run test`：pass，`17 files / 79 tests`，`real 3.54s`
- `pnpm -s run build`：pass，`dist/index.js 95.41 kB`（gzip `20.35 kB`），`real 1.41s`

## Decision

採用「名稱索引快路徑」：

1. 在 `ProfileStore` 新增 `listNames()`，`FileProfileStore` 直接以 `readdir` 取得 `profiles/*.json` 檔名，經名稱驗證後排序回傳。
2. 在 `ProfileService` 新增 `listProfileNames()`，供只需名稱的場景使用。
3. `completion profiles` 改用 `listProfileNames()`，保留 `--prefix` / `--limit` 行為與 CLI 介面不變。
4. 既有 `listProfiles()` 保留原語意（需要完整 profile 時仍讀取 JSON），避免擴大變更範圍。

## Alternatives Considered

1. 維持現況，繼續走 `listProfiles()`
- 優點：零改動。
- 缺點：高頻補全仍承受不必要 IO/解析成本，且對壞檔韌性差。

2. 在 completion 內自行掃檔名，不經 service/store abstraction
- 優點：改動看似最少。
- 缺點：破壞分層，重複儲存邏輯，後續維護成本提高。

3. 讓 `listProfiles()` 在壞檔時吞錯繼續
- 優點：可改善壞檔韌性。
- 缺點：completion 仍需解析所有 JSON，效能瓶頸未解。

## Consequences

正面：

- `completion profiles` 在大量 profile 下有更低 IO/CPU 成本（不再解析每個 JSON）。
- 單一無關損壞 JSON 檔不再阻斷補全主流程（名稱由檔名取得）。
- 保持向後相容：CLI 旗標與輸出格式不變。

負面與風險：

- completion 候選改為檔名來源，若檔名合法但內容壞掉，仍可能被補全出來，後續執行命令時才報錯。
- `ProfileStore` 介面新增方法，需同步調整測試中的 in-memory store。

遷移與維護：

- 無資料遷移。
- 回滾可直接 revert 本次變更，不影響已儲存資料。

## Rollout Plan

1. 先新增 e2e 測試：壞檔存在時 completion 仍可回傳 prefix 命中結果。
2. 新增 `ProfileStore.listNames()` 與 `ProfileService.listProfileNames()`。
3. completion action 切換到名稱索引路徑。
4. 更新 README 與 `docs/cli.md` 說明 completion 行為。
5. 執行 `lint/typecheck/test/build` 驗證品質門檻。

回滾策略：

- 若發生回歸，直接 revert 本次 commit；`listProfiles()` 舊路徑仍完整可用。

## Test Plan

- e2e：
  - 新增「有無關損壞 JSON 時，`completion profiles --prefix` 仍有輸出」案例。
  - 既有 `--limit`、unsupported topic、snippet guard 測試持續通過。
- 回歸品質門檻：
  - `pnpm -s run lint`
  - `pnpm -s run typecheck`
  - `pnpm -s run test`
  - `pnpm -s run build`

## Observability

目前專案無集中 telemetry，本輪以可驗證訊號觀測：

- completion e2e pass rate（特別是壞檔韌性案例）。
- tab 補全輸出行為是否維持穩定（prefix/limit 行為不變）。
- 若後續導入 metric，可追蹤 completion command 平均執行時間與失敗率。

## Security/Privacy

- 仍僅操作本機 profile 檔案與名稱，不新增網路傳輸。
- 不新增 token/PII 輸出內容。
- 名稱仍經 `validateProfileName` 驗證，維持路徑安全限制。

## Open Questions

1. 是否要提供 `completion profiles --strict`（僅列出可成功解析的 profile）？
2. 是否需要在 doctor 加上「profile JSON 損壞檢查」，提前提示修復？
