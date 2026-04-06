# ADR-20260301: 為 `gitface rm/remove` 新增 `--dry-run` 安全預覽模式

## Context

`gitface rm <profile>`（alias: `remove`）會直接刪除 profile JSON 檔案。對使用者與維運腳本而言，這條路徑屬於不可逆操作：

- 使用者無法在執行前確認「即將刪除的是哪筆資料」。
- CI/自動化流程無法先做預演驗證，再分階段實際刪除。
- 當 profile 不存在時，雖已有 `--force` 降低失敗中斷風險，但沒有「只檢查不寫入」選項。

本輪 baseline（2026-03-01, local）:

- `pnpm -s lint`：通過
- `pnpm -s typecheck`：通過
- `pnpm -s test`：17 files / 75 tests 全通過
- `pnpm -s build`：通過，`dist/index.js` 93.70 kB（gzip 20.05 kB）
- 目前 `remove` 指令覆蓋率偏低（`action.tsx` statements 約 48.48%、branches 約 30%），且缺乏 dry-run 路徑

## Decision

新增 `gitface rm/remove --dry-run`（MVP，向後相容）：

1. `--dry-run` 下不執行任何刪除寫入。
2. 會讀取目標 profile 並輸出「將刪除」預覽：
   - human mode：明確顯示 dry-run 與 profile 內容。
   - JSON mode：回傳穩定 payload（`status: "dry-run"`）。
3. 若 profile 不存在：
   - `--force` 維持可跳過（`status: "skipped"`）。
   - 非 `--force` 維持既有錯誤行為與 suggestions。
4. 不改變既有 `rm/remove`（未加 `--dry-run`）語義。

## Alternatives Considered

1. 新增獨立命令 `remove-preview`
- 優點：語義明確。
- 缺點：命令面擴張、重複邏輯、學習成本增加。

2. 維持現狀，只依賴 `--force`
- 優點：零開發成本。
- 缺點：仍無法預演既有 profile 刪除影響，對人與腳本都不夠安全。

3. 刪除前強制互動確認
- 優點：降低手動誤刪。
- 缺點：不適合非互動流程，且無法提供可機器解析的預演結果。

## Consequences

正面：

- 提升刪除操作可預期性，降低誤刪風險。
- 強化 automation 可觀測性與可回放性（可先 dry-run 記錄，再正式執行）。
- 屬 additive 變更，舊流程可無痛沿用。

負面 / 代價：

- `remove` 指令分支邏輯增加，需要維持 dry-run 與實際刪除行為一致性。
- 需新增 JSON payload 契約並長期維護。

風險與遷移：

- 風險：dry-run 呈現與真實刪除結果若分歧，會造成誤判。
- 遷移：不需資料遷移。
- 回滾：移除 `--dry-run` flag 與對應分支即可快速回復。

## Rollout Plan

1. 先補 e2e 測試：驗證 dry-run 不刪除、JSON payload、錯誤/force 行為。
2. 實作 command option、action 分支與輸出函式。
3. 更新 README 與 `docs/cli.md`。
4. 執行 `lint/typecheck/test/build`。
5. 若回歸風險出現，單一 commit 回滾 `--dry-run` 相關變更。

Feature flag / 設定：

- 不需要額外 feature flag，`--dry-run` 本身即 opt-in。

## Test Plan

- E2E
  - `gitface remove <name> --dry-run`：輸出預覽且 profile 仍存在。
  - `gitface remove <name> --dry-run --json`：輸出 `status: "dry-run"` 且 profile 仍存在。
  - `gitface remove <missing> --dry-run --json`：維持錯誤與 exit code `1`。
- Regression
  - 既有 `remove` 與 `remove --json` 路徑仍可正常刪除。
- Quality gates
  - `pnpm -s lint`
  - `pnpm -s typecheck`
  - `pnpm -s test`
  - `pnpm -s build`

## Observability

專案目前無外部 telemetry，採用以下可觀測訊號：

- CLI exit code（dry-run 應為 0；missing 非 force 應為 1）。
- `--json` payload（`status`、`name`、`force`）可直接進 CI log 分析。
- e2e 測試保證 dry-run no-write 契約。

建議追蹤關鍵指標：

- `remove --dry-run` 使用比例。
- remove 操作失敗率（missing/non-force）。
- 誤刪回報數（預期下降）。

## Security / Privacy

- 無新網路呼叫。
- 僅讀取本地 profile 內容並輸出既有身份資料欄位。
- `--dry-run` 以「先驗證、後執行」降低誤操作風險，符合最小風險原則。

## Open Questions

- 是否需要後續補上 `remove --dry-run --force` 的 human mode 明確標示（例如 `Dry run skipped`）以提升一致性？
- 是否應在未來提供 `--confirm <token>`（由 dry-run 產生）避免 TOCTOU 差異？
