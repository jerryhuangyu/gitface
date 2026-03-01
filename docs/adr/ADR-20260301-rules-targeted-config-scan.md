# ADR-20260301: rules 指令改為精準掃描 includeIf 規則鍵

## Context

GitFace 的 `rules list/resolve/apply/doctor/prune` 目前都透過 `GitService.getAllConfig("global")`
先抓取整份全域 Git 設定，再由 `Rule.parse` 過濾 `includeIf.gitdir:*` 規則。

現況痛點：

- 使用者 `.gitconfig` 可能包含大量非規則設定（憑證、alias、tool 設定、include 鏈）。
- 每次 rules 指令都要解析完整設定，造成不必要 I/O 與字串處理。
- 在大型設定環境中，rules 命令反應時間會隨「非規則設定」膨脹。

本輪 baseline（2026-03-01，本地）：

- `pnpm run lint`：0.53s
- `pnpm run typecheck`：1.28s
- `pnpm run test`：6.08s（122 tests）
- `pnpm run build`：1.10s
- `dist/index.js`：135.55 kB（gzip 26.70 kB）

雖然 baseline 全綠，但 `rules` 路徑在使用量增加時存在可預期效能負擔。

## Decision

在 `GitService` 新增「正則精準讀取設定」能力，並讓 `RuleService.listRules()` 優先使用：

1. 新增 `getConfigByRegexp(pattern, scope)`，底層使用：
   `git config --<scope> --get-regexp <pattern>`
2. `RuleService.listRules()` 改為只抓取
   `^includeif\\.gitdir:.*\\.path$` 的鍵值，避免完整掃描。
3. 若精準讀取發生非預期錯誤，保留回退機制：退回舊流程 `getAllConfig("global")`，確保相容性與可回滾。

MVP 範圍：僅調整讀取策略，不更改 rule 格式、CLI 介面與輸出 schema。

## Alternatives Considered

1. 維持現狀（全域全量掃描）
- 優點：零改動。
- 缺點：規模放大時延遲惡化，且每次都解析大量無關設定。

2. 建立 rules 快取檔（記憶體或磁碟）
- 優點：理論上最快。
- 缺點：快取失效策略複雜（跨程序、手動改 git config、include 鏈變更），容易產生一致性錯誤。

3. 直接解析 `~/.gitconfig` 與 include 檔案
- 優點：可自訂最佳化邏輯。
- 缺點：需重做 Git 設定解析語意，跨平台與 edge case 風險高，維護成本大。

## Consequences

正面：

- `rules` 相關命令對大型全域設定更穩定，減少不必要解析成本。
- 設計與 Git 原生命令一致，行為可預期。
- 保留 fallback，降低部署風險。

負面 / 風險：

- `--get-regexp` 回傳格式與 `--list` 不同，需要新解析邏輯。
- 若環境 Git 行為特殊，可能觸發 fallback，效能收益下降。

遷移 / 維護成本：

- 無使用者遷移成本。
- 新增少量測試維護成本（命令參數與解析案例）。

## Rollout Plan

1. 第 1 階段（本輪 MVP）
- 新增 `GitService.getConfigByRegexp`。
- `RuleService.listRules` 導入精準掃描 + fallback。
- 補單元測試，驗證 no-match 與含空白值解析。

2. 第 2 階段（後續）
- 補 micro-benchmark（大量 config 鍵）比較舊/新路徑耗時。
- 視結果決定是否移除 fallback（需跨平台驗證後）。

Feature flag / 設定：

- 本輪不新增外部 flag；透過內部 fallback 達成風險控制。

回滾策略：

- 若出現相容問題，單點回退 `RuleService.listRules` 到 `getAllConfig("global")` 即可。

## Test Plan

- 單元測試：
  - `getConfigByRegexp` 正常解析鍵值（含 value 空白字元）。
  - `getConfigByRegexp` 在 no-match（exit code 1）時回傳空物件。
- 回歸測試：既有 `rules` e2e 全量跑過，確認 CLI 行為與 JSON output 不變。
- 型別/靜態檢查：`typecheck`、`lint`。
- 建置測試：`build`。

## Observability

- 在 `RuleService.listRules` 加入 debug/warn log：
  - 命中精準掃描與規則數量。
  - fallback 發生次數與錯誤原因。
- 關鍵指標：
  - `rules` 指令端到端耗時（後續可在 benchmark/CI 補儀表）。
  - fallback 比率（理想接近 0）。

## Security/Privacy

- 僅讀取本機 Git 設定，不新增網路或外部傳輸。
- 不新增敏感資料儲存。
- 日誌避免輸出完整憑證內容（只記錄錯誤訊息與統計）。

## Open Questions

- 是否需要在 CI 長期加入 `rules` 路徑效能基準（避免未來回歸）。
- 是否在穩定後移除 fallback 以簡化程式碼。
