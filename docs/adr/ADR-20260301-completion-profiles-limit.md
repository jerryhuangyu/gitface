# ADR-20260301: 為 `gitface completion profiles` 增加 `--limit` 並在 shell snippet 預設啟用

## Context

GitFace 的 shell 補全目前透過：

- `gitface completion profiles --prefix <value>`

每次按下 tab 都會列出符合前綴的所有 profile 名稱，沒有上限控制。當 profile 數量成長（例如團隊/多專案環境）時，會帶來以下問題：

- 補全輸出可能過大，增加 shell 補全命令執行時間與終端處理成本。
- bash/zsh snippet 目前未限制筆數，風險會直接傳導到互動體驗。
- 使用者大多只需要前幾個候選值，完整清單在補全情境通常不是必要。

本輪 baseline（2026-03-01）量測：

- `pnpm -s run lint`：通過，`0.33s`
- `pnpm -s run typecheck`：通過，`1.53s`
- `pnpm -s run test`：通過，`17 files / 77 tests`，`3.77s`
- `pnpm -s run build`：通過，`1.76s`
- 產物大小：`dist/index.js` `94.94 kB`（gzip `20.29 kB`）

## Decision

新增 `gitface completion profiles --limit <number>`，並調整 snippet 預設為帶上 `--limit 50`：

1. `completion profiles` 新增 `-l, --limit <number>`。
2. `--limit` 需為正整數；非法值回傳錯誤並設定 `process.exitCode = 1`。
3. 先做 prefix 過濾，再套用 limit，維持現有語義。
4. 不帶 `--limit` 時維持既有行為（向後相容）。
5. `completion snippet --shell bash|zsh` 生成的腳本改為呼叫：
   - `gitface completion profiles --prefix "$cur|$PREFIX" --limit 50`

這個決策以最小範圍改善高頻互動路徑，避免補全輸出無界成長。

## Alternatives Considered

1. 僅維持現況，不新增限制

- 優點：零改動、零相容性風險。
- 缺點：無法緩解大量 profile 下的補全卡頓風險。

2. 直接硬編碼固定上限（例如永遠 50）且不提供旗標

- 優點：實作最簡單。
- 缺點：失去彈性；進階使用者無法調整行為。

3. 改成 shell 端自行截斷（在 bash/zsh snippet 裡處理）

- 優點：CLI 介面不變。
- 缺點：兩個 shell 實作分岐、可維護性差，且其他消費方無法受益。

## Consequences

正面：

- 補全輸出可被明確上限控制，改善大規模 profile 情境的互動體驗。
- snippet 預設即受益，現有使用者無需額外設定。
- CLI 層提供通用機制，便於未來其他整合端重用。

負面/風險：

- 預設 snippet 限制候選筆數，極端情況下可能看不到排序後靠後的候選值。
- 新增參數驗證邏輯，需避免與既有行為衝突。

遷移與維護：

- 向後相容：不使用 `--limit` 時行為不變。
- 若需要回退，可回滾 snippet 的 `--limit 50` 或完整回滾本次 commit。

## Rollout Plan

1. 補 e2e 測試覆蓋 `--limit` 正常與錯誤情境。
2. 實作 `completion` 命令解析與截斷邏輯。
3. 更新 bash/zsh snippet 模板使用 `--limit 50`。
4. 更新 README 與 `docs/cli.md`。
5. 執行 `lint/typecheck/test/build`。
6. 若發生回歸：
   - 快速回滾策略 A：移除 snippet 的 `--limit 50`（保留可選旗標）。
   - 快速回滾策略 B：revert 本次 commit。

## Test Plan

- 單元/整合：以現有 e2e 測試擴充 completion 行為。
- 新增驗收案例：
  - `--limit` 會限制輸出筆數。
  - `--limit` 非正整數時設定 exit code 並不輸出建議。
  - snippet 內容包含 `--limit 50`。
- 回歸：
  - 既有 prefix 過濾測試仍需通過。
  - 既有 snippet shell guard 測試仍需通過。
- 品質閘道：
  - `pnpm run lint`
  - `pnpm run typecheck`
  - `pnpm run test`
  - `pnpm run build`

## Observability

關鍵指標：

- 補全輸出筆數（應符合 `min(符合prefix數, limit)`）。
- 大量 profile 情境下，補全命令平均輸出大小（bytes）應下降。
- CI 中 completion 測試穩定通過率。

目前無集中式 telemetry，先以 e2e 驗證與本地量測（輸出行數/bytes）作為觀測。

## Security/Privacy

- 補全輸出仍僅包含 profile 名稱，不新增敏感資訊暴露。
- `--limit` 僅控制輸出規模，不涉及權限與憑證處理。

## Open Questions

- `--limit` 預設值是否要提升為 CLI 預設（非 snippet 限定）？
- 未來是否需要 `--sort`（例如最近使用優先）來提升候選命中率？
