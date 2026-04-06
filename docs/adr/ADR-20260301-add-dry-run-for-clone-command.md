# ADR-20260301: 為 `gitface clone` 新增 `--dry-run` 安全預覽模式

## Context

`gitface clone <source> <target>` 目前會直接建立新 profile。雖然已支援 `--force` 控制覆蓋，但在腳本或 CI 情境，仍缺乏「先驗證、再落地」能力，造成以下痛點：

1. 高風險變更前無法預覽結果，使用者容易在參數誤填時寫入錯誤資料。
2. 自動化流程難以先檢查來源存在性、目標衝突與覆蓋語意。
3. 與 `use`、`import`、`remove`、`rename` 已有 `--dry-run` 的體驗不一致。

本輪 baseline（2026-03-01，本機）：

- `pnpm run lint`：pass，`real 0.25s`
- `pnpm run typecheck`：pass，`real 0.76s`
- `pnpm run test`：pass，`17 files / 82 tests`，`real 3.30s`
- `pnpm run build`：pass，`dist/index.js 97.72 kB`（gzip `20.66 kB`），`real 0.93s`

## Decision

為 `gitface clone` 新增 `--dry-run`（MVP、向後相容）：

1. CLI 增加 `clone --dry-run` 選項，預設行為不變。
2. `--dry-run` 會執行來源/目標驗證，但不寫入 profile 檔案：
   - 檢查 `source` 是否存在；
   - 檢查 `target` 是否存在（搭配 `--force` 決定是否允許覆蓋）。
3. `--dry-run --json` 輸出穩定可解析 payload：
   - `status`, `sourceName`, `targetName`, `overwrite`, `gitName`, `email`, `signingKey`。
4. 非 JSON 模式顯示明確「不會寫檔」提示與預計 clone 的內容。
5. 錯誤與 exit code 規則沿用既有 clone 行為（失敗 `exit code = 1`）。

## Alternatives Considered

1. 維持現況，不新增 `--dry-run`
- 優點：零開發成本。
- 缺點：無法先驗證 clone 影響，誤操作成本較高。

2. 只靠文件建議先 `list` 再 `clone`
- 優點：不改程式碼。
- 缺點：流程分散且不可機器驗證，對 CI 幫助有限。

3. 設計全域 `--plan` 一次支援所有命令
- 優點：長期一致性更高。
- 缺點：範圍過大，會拉高本輪風險與交付時間。

## Consequences

正面：

- clone 操作可先預演，降低誤建/誤覆蓋風險。
- 自動化可先跑 dry-run 再決定是否實際執行，提升可靠性。
- 命令 UX 與其他高風險命令更一致。

負面與風險：

- `clone` 分支邏輯增加，需維護 dry-run 與真實執行語意一致。
- 存在 TOCTOU 風險：dry-run 與實際執行之間若狀態改變，結果可能不同。

遷移與維護：

- 無資料格式遷移需求。
- 回滾可直接 revert 本次變更，恢復既有行為。

## Rollout Plan

1. 先新增 clone dry-run e2e 測試（一般與 `--force` 覆蓋情境）。
2. 新增 `clone` command flag 與 action dry-run 分支。
3. 新增 dry-run human/JSON 輸出函式。
4. 更新 README 與 CLI 文件。
5. 執行 `lint/typecheck/test/build` 並確認無回歸。

feature flag / 設定：

- 不新增額外 feature flag，由 `--dry-run` 顯式啟用。

回滾策略：

- 若觀察到回歸，直接回滾本次 commit。

## Test Plan

- E2E：
  - `clone --dry-run --json` 不應建立 target profile，並回傳 preview payload。
  - `clone --dry-run --force --json` 在 target 已存在時應回傳 `overwrite: true` 且不改檔。
- 回歸：
  - 既有 clone 成功/失敗/JSON 行為保持不變。
- 品質閘道：
  - `pnpm run lint`
  - `pnpm run typecheck`
  - `pnpm run test`
  - `pnpm run build`

## Observability

目前無外部 telemetry，本輪以以下訊號觀測：

1. 測試訊號：clone e2e dry-run 路徑穩定通過。
2. 行為訊號：dry-run JSON 欄位完整且可被腳本解析。
3. 可靠性訊號：dry-run 明確保證 no-write（以檔案存在性驗證）。

若後續導入 metrics，建議新增：

- clone 執行次數（dry-run vs real-run）；
- clone 失敗率（來源不存在、目標衝突）。

## Security/Privacy

- 不新增外部網路存取，僅讀取本機 profile。
- `--dry-run` 可降低誤覆蓋與誤寫入風險。
- 輸出欄位沿用既有 profile 資料，不新增敏感資訊收集。

## Open Questions

1. 是否要在未來將 `clone` dry-run 輸出擴充為結構化 diff（例如新增 `createdAt/updatedAt` 預期值）？
2. 是否要引入確認 token 機制，降低 dry-run 與 real-run 之間的 TOCTOU 落差？
