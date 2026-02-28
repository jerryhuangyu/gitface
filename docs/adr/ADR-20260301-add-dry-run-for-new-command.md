# ADR-20260301: 為 `gitface new` 新增 `--dry-run` 安全預覽

## Context

`gitface new` 會直接寫入 profile 檔案與 identity include 檔，屬於持久化變更；目前雖然支援 `--json`，但缺乏「先預覽再落地」能力。這在腳本與批次維運場景有兩個主要痛點：

1. 建立前無法先確認 fallback 後的最終 identity（`gitName`/`email`/`signingKey`）。
2. 在目標 profile 已存在時，無法先預覽 overwrite 狀態就會遇到寫入/覆蓋決策。

本輪 baseline（2026-03-01，本機）：

- `pnpm run lint`：pass（Checked 65 files，約 0.35s）
- `pnpm run typecheck`：pass（約 0.92s）
- `pnpm run test`：pass（17 files / 86 tests，Vitest duration 約 3.00s）
- `pnpm run build`：pass（`dist/index.js` 101.83 kB，gzip 21.27 kB，約 1.27s）

## Decision

對 `gitface new <profile>` 新增 `--dry-run`（MVP，向後相容）：

1. CLI 選項：
   - `gitface new <profile> --dry-run`
2. 行為：
   - 走既有非互動路徑與驗證規則（包含 profile name 驗證、必要欄位/fallback 計算、存在性檢查與 `--force` 規則）。
   - 不寫入任何 profile/identity 檔案。
3. JSON 契約（`--dry-run --json`）：
   - `status`, `name`, `overwrite`, `gitName`, `email`, `signingKey`。
4. 人類可讀輸出明確標示：
   - `Dry run: no profile files were changed.`
5. 非 dry-run 路徑維持既有建立邏輯與 exit code。

## Alternatives Considered

1. 維持現況（只提供 `new --json`）
- 優點：零開發成本。
- 缺點：缺乏安全預演，無法先確認 fallback identity 與覆蓋風險。

2. 只在 CLI 層新增簡易 dry-run（不重用 service 驗證）
- 優點：改動小。
- 缺點：容易與真實建立邏輯漂移，造成 dry-run/real-run 不一致。

3. 一次為 `new` + `edit` 同步導入 dry-run
- 優點：命令體驗更完整。
- 缺點：範圍擴大，不符本輪單一最小可行改進原則。

## Consequences

正面：

- 新增 profile 前可先確認最終資料與覆蓋狀態，降低誤寫入風險。
- 自動化流程可先解析 dry-run JSON，再決定是否正式執行。
- `new` 與既有 `use/import/remove/rename/clone/rules` 的 dry-run 體驗更一致。

負面與風險：

- 命令分支增加，需持續維持 dry-run 與實際路徑語意一致。
- 存在 TOCTOU 風險：dry-run 後到 real-run 前目標 profile 可能被其他程序改變。

遷移與維護：

- 無資料格式遷移；僅擴充 CLI 選項與輸出。
- 回滾可直接 revert 本次 commit。

## Rollout Plan

1. 先補 e2e：驗證 `new --dry-run --json` 不寫檔且回傳契約穩定。
2. 在 service 新增可重用的 create 規劃方法（共享驗證邏輯）。
3. 在 `new` 命令接入 dry-run human/JSON 輸出。
4. 更新 `README`、`docs/cli.md`、`docs/user-manual.zh-TW.md`。
5. 執行 `lint/typecheck/test/build`，全綠後交付。

feature flag / 設定：

- 不新增 feature flag，由 `--dry-run` 顯式啟用。

回滾策略：

- 若有回歸，直接 revert 本次 commit。

## Test Plan

- E2E：
  - `new --dry-run --json`：回傳 `status: dry-run`，且 profile 檔案不新增。
  - `new --force --dry-run --json`：回傳 `overwrite: true`，且既有 profile 不被改寫。
- 回歸：
  - 既有 `new` 成功建立與 `new --json` 錯誤分支維持不變。
- 品質閘道：
  - `pnpm run lint`
  - `pnpm run typecheck`
  - `pnpm run test`
  - `pnpm run build`

## Observability

目前以測試與 CLI 輸出作為可觀測訊號：

1. 測試訊號：dry-run e2e 穩定通過且驗證 no-write。
2. 契約訊號：`--dry-run --json` 欄位固定、可被腳本解析。
3. 行為訊號：dry-run 前後 profile 存在性與內容一致（無副作用）。

後續可擴充：

- 記錄 `new` 命令 dry-run vs real-run 次數比例（匿名指標）。
- 追蹤 `overwrite=true` 發生率，評估是否需要更強提示。

## Security/Privacy

- 不新增網路 I/O 與第三方依賴。
- `--dry-run` 降低 profile 檔案誤覆蓋風險。
- JSON 輸出沿用既有 identity 欄位，不新增 token 或敏感憑證。

## Open Questions

1. 是否要在未來支援 `edit --dry-run`，讓 `new/edit` 都具備 mutation preview？
2. `new --dry-run` 是否需要輸出來源標記（使用者輸入 vs Git fallback）以提升可解釋性？
