# ADR-20260301：為 list 指令增加可選排序模式

## Context

GitFace 的 `gitface list` 目前固定以 `updatedAt` 由新到舊排序。這對「剛修改過的 profile」情境友善，但在 profile 數量變多（例如工作/副業/客戶分身並存）時，使用者常需要以名稱快速掃描特定 profile，現況需先用 `--query` 試字串，互動成本偏高。

本輪 baseline（2026-03-01）顯示品質閘門可作為安全變更基線：

- `pnpm run lint`：通過（`real 0.48s`）
- `pnpm run typecheck`：通過（`real 1.02s`）
- `pnpm run test`：通過（`135/135`，`real 13.73s`，coverage statements `73.55%`）
- `pnpm run build`：通過（`real 1.09s`，`dist/index.mjs` `143.18 kB`，gzip `28.02 kB`）

另外，現有 `list --json` 已被腳本使用，任何輸出結構破壞都會增加遷移成本，因此本輪需要在「可用性提升」與「向後相容」之間取得平衡。

## Decision

為 `gitface list` 新增 `--sort <mode>`，MVP 支援兩種排序模式：

- `updated`：依 `updatedAt` 由新到舊（**預設，保持向後相容**）
- `name`：依 profile 名稱不分大小寫升冪排序

執行順序維持：先排序，再套用 `--query`，最後套用 `--limit`。JSON 與人類可讀輸出都共用同一排序結果。

參數驗證：`--sort` 僅接受 `updated` 或 `name`，其餘值回傳明確錯誤並設 exit code `1`。

## Alternatives Considered

1. 僅維持 `--query`，不新增排序模式
- 優點：零實作成本。
- 缺點：當使用者不確定關鍵字或需瀏覽全量 profile 時，體驗仍不佳。

2. 直接把預設排序改成 `name`
- 優點：列表更直覺。
- 缺點：破壞既有「最近更新優先」行為，可能影響腳本與使用習慣。

3. 一次加入 `--sort` + `--order`（asc/desc）完整排序矩陣
- 優點：彈性最高。
- 缺點：超出本輪 MVP 範圍，測試與文件成本上升。

## Consequences

正面：

- 提升大量 profile 情境的可探索性與操作效率。
- 保持預設行為不變，降低升級風險。
- 提升腳本可讀性：可明確指定輸出順序，減少下游二次排序。

負面與風險：

- CLI 參數表面積增加，需維護更多驗證與文件。
- 需避免錯誤模式造成模糊訊息（例如 typo）。

遷移與維護成本：

- 遷移成本低，因為預設仍為 `updated`。
- 需要新增 e2e 覆蓋兩種排序與錯誤輸入。

## Rollout Plan

1. 新增 `list --sort` 參數與 mode parser。
2. 實作排序邏輯並共用到 JSON / TTY / 非 TTY 輸出。
3. 新增 e2e：`--sort name`、`--sort updated`、非法值錯誤。
4. 更新 README 與 `docs/cli.md`。
5. 全量跑 `lint + typecheck + test + build`。

回滾策略：

- 若發現兼容性問題，移除 `--sort` 參數與對應分支；因預設路徑不變，回滾風險低。

## Test Plan

- E2E：
  - `list --json --sort name` 名稱升冪驗證。
  - `list --json --sort updated` 仍維持更新時間降冪。
  - `list --sort invalid` 需輸出錯誤並 exit code `1`。
- 回歸：`pnpm run lint`、`pnpm run typecheck`、`pnpm run test`、`pnpm run build`。

## Observability

- 以既有 CLI 輸出與 exit code 作為主要可觀測訊號。
- 關鍵指標：
  - `list --sort` 錯誤率（非法 mode 觸發次數）。
  - 在測試層確保排序 determinism，降低下游腳本排序漂移。

## Security/Privacy

- 不新增外部 I/O 或網路通訊。
- 不改變 profile 儲存格式與路徑。
- 不輸出額外敏感資訊。

## Open Questions

- 後續是否需要 `--order asc|desc` 以支援完整排序方向控制？
- `rules list` 是否也應對齊 `--sort` 參數語意，建立跨指令一致性？
