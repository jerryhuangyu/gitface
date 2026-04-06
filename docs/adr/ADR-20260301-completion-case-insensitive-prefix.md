# ADR-20260301: completion profiles 前綴比對改為不分大小寫

## Context

`gitface completion profiles --prefix <value>` 目前使用大小寫敏感的 `startsWith` 比對。  
這在真實 shell 補全情境會造成可用性問題：若 profile 名稱含大寫（例如 `WorkAdmin`），使用者輸入小寫前綴 `wo` 時拿不到建議，增加補全失敗率。

本輪 baseline（2026-03-01，本機）：

- `pnpm run lint`：pass，約 `0s`
- `pnpm run typecheck`：pass，約 `1s`
- `pnpm run test`：pass，`17 files / 88 tests`，約 `4s`
- `pnpm run build`：pass，`dist/index.js 103.78 kB`（gzip `21.50 kB`），約 `1s`
- 目前 coverage：Statements `77.33%`、Branches `64.3%`、Lines `77.61%`

## Decision

將 completion prefix 過濾改為不分大小寫：

1. 在 `src/commands/completion/action.ts` 新增 `filterByPrefix()`，對 `prefix` 與候選 `name` 都做 `toLowerCase()` 後再比對 `startsWith`。
2. 保持現有 CLI 介面與輸出格式不變（`--prefix`、`--limit`、分隔符邏輯不變）。
3. 新增 e2e 測試覆蓋 `--prefix` 不分大小寫行為。
4. 更新 README、CLI reference、zh-TW 手冊說明。

## Alternatives Considered

1. 維持大小寫敏感（現況）
- 優點：零改動。
- 缺點：補全命中率低，與多數使用者直覺不符。

2. 新增 `--ignore-case` 旗標，預設維持大小寫敏感
- 優點：完全保留舊行為，變更明確。
- 缺點：增加 CLI 複雜度，且 shell snippet 仍需額外調整才會受益。

3. 在 shell snippet 端處理大小寫（CLI 不改）
- 優點：CLI 變更最少。
- 缺點：bash/zsh 行為可能分歧，且非 snippet 消費端無法受益。

## Consequences

正面：

- shell 補全更符合直覺，降低「明明有 profile 但補不到」的體驗落差。
- 對既有腳本與自動化相容：輸出資料結構無變更，只擴大匹配集合。

負面與風險：

- 某些依賴大小寫敏感結果的非常規腳本可能看到更多候選值。
- 比對時增加一次 `toLowerCase()`，但資料量通常很小，效能影響可忽略。

遷移與回滾：

- 無資料遷移需求。
- 回滾可直接 revert 本次 commit。

## Rollout Plan

1. 新增 e2e 測試（先紅後綠）：`--prefix` 可匹配大寫名稱。
2. 調整 completion action 比對邏輯。
3. 更新文件（README、`docs/cli.md`、`docs/user-manual.zh-TW.md`）。
4. 執行 `lint/typecheck/test/build`。
5. 若出現回歸，直接回滾該 commit。

## Test Plan

- e2e：
  - 新增 `matches --prefix case-insensitively`。
  - 既有 completion 測試（limit、topic、snippet）需全部通過。
- 回歸品質門檻：
  - `pnpm run lint`
  - `pnpm run typecheck`
  - `pnpm run test`
  - `pnpm run build`

## Observability

目前無集中式 telemetry，採以下可觀測訊號：

- completion e2e 測試 pass rate。
- 手動驗證 `gitface completion profiles --prefix wo` 對 `Work*` 名稱的命中率。
- 後續可在 logger 加入 completion topic/prefix 命中數統計（非本次範圍）。

## Security/Privacy

- 僅處理本機 profile 名稱，不新增資料來源與權限需求。
- 不新增敏感資訊輸出，隱私風險不變。

## Open Questions

1. 未來是否要支援 `--contains`（非前綴）補全模式？
2. 是否需要在 completion 回傳中加入排序策略（例如最近使用優先）？
