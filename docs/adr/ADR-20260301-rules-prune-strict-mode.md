# ADR-20260301：為 `gitface rules prune` 新增 `--strict` 以支援 CI Gate

## Context

GitFace 目前的規則治理流程已有：

- `rules doctor --strict`：可在規則有 `warn/fail` 時讓 CI 失敗。
- `rules prune`：可清理 stale 規則（missing profile，或搭配 `--include-missing-directory`）。

但 `rules prune` 缺少 strict gate 語意，造成兩個實務問題：

1. 在只想「檢查是否有 stale 規則」的 dry-run 場景，無法僅靠 exit code 讓 pipeline fail。
2. 維運腳本需要自行解析 JSON `summary.prunable` 才能決策，與 `doctor/resolve/apply` 的 `--strict` 操作心智不一致。

本輪 baseline（2026-03-01）：

- `pnpm run lint` 通過（Checked 69 files，0 問題）。
- `pnpm run test` 通過（`114 passed`，約 `5s`）。
- `pnpm run build` 通過（`dist/index.js 133.44 kB, gzip 26.17 kB`，約 `1s`）。
- 既有 `rules prune` e2e 覆蓋 dry-run/apply 與 include-missing-directory，但未覆蓋 strict gating 行為。

## Decision

為 `gitface rules prune` 新增 `--strict` 選項，並定義「依執行模式判定未解決風險」的退出碼規則。

MVP 規格：

- 新增命令旗標：`gitface rules prune --strict`（可與 `--dry-run`、`--json`、`--include-missing-directory` 組合）。
- 退出碼規則：
  - `dry-run + strict`：若 `summary.prunable > 0`，回傳 exit code `1`（代表偵測到待清理風險）。
  - `apply + strict`：若 `summary.skipped > 0`，回傳 exit code `1`（代表仍有未清理成功風險）。
  - 其他情況維持 exit code `0`。
- JSON 輸出新增 `strict` 欄位，避免腳本端需自行反推模式。

設計重點：

- 保持向後相容：不加 `--strict` 時，沿用現有行為。
- `apply + strict` 不因「已成功清理 (`pruned > 0`)」而失敗，避免「修復成功但 pipeline 仍 fail」的反直覺結果。

## Alternatives Considered

1. `rules prune` 永遠在 `prunable > 0` 時非零退出（不提供 `--strict`）

- 優點：行為直覺、實作最簡。
- 缺點：破壞既有腳本；一般維運執行會被迫處理非零退出，不利向後相容。

2. 不改 CLI，只要求使用者解析 JSON `summary`

- 優點：零 CLI 變更、零相容風險。
- 缺點：腳本重複邏輯高，且與 `doctor/resolve/apply --strict` 的產品心智不一致。

3. 新增 `rules check-prune` 獨立命令

- 優點：語意清晰（check 與 fix 分離）。
- 缺點：命令面膨脹，與既有 `prune --dry-run` 功能重疊。

## Consequences

正面：

- `rules prune` 可直接作為 CI gate，降低 stale 規則滯留時間。
- 與既有 strict 家族一致，減少學習成本與腳本分歧。
- 可在 dry-run 模式下安全檢測，無副作用。

負面與風險：

- 使用者若不理解 strict 語意，可能在 dry-run 場景看到更多非零退出。
- JSON 輸出新增欄位需在文件清楚說明（雖為向後相容 additive 變更）。

遷移與維護成本：

- 無資料遷移，僅命令選項/退出碼與文件更新。
- 需維護 strict 行為測試矩陣（dry-run 與 apply）。

## Rollout Plan

1. Phase 1（本輪 MVP）

- 新增 `rules prune --strict` 命令選項。
- 實作 strict 退出碼判定。
- 補 e2e：
  - dry-run + strict + 有候選 => exit code `1`
  - apply + strict + 全部成功清理 => exit code `0`
- 更新 README / CLI / 使用手冊。

2. Phase 2（後續）

- 評估 `--strict-level`（例如 `detect-only`、`unresolved-only`）以支援更細緻策略。

3. 回滾策略

- 若 strict 語意導致整合混亂，可移除 `--strict` 選項並 revert 本次 commit；原先 prune 流程可完整恢復。

## Test Plan

- E2E：
  - `rules prune --dry-run --strict --json`：有候選時回傳 `status: "dry-run"` 且 exit code `1`。
  - `rules prune --strict --json`：成功清理且無 skipped 時回傳 exit code `0`。
- 回歸：
  - 既有 prune 測試（missing profile / missing directory）持續通過。
  - 全量 `pnpm run lint`、`pnpm run test`、`pnpm run build`。

## Observability

- JSON 增加 `strict` 布林欄位，配合既有 `summary` 提供腳本判斷依據。
- Human output 保留 summary（`prunable/pruned/skipped`）並由 exit code 暴露 gate 結果。
- 關鍵指標：
  - `summary.prunable`（偵測到的 stale 規則數）
  - `summary.skipped`（未清理成功規則數）
  - `strict` 模式非零退出率（CI 觀測）

## Security/Privacy

- 只讀寫本機 git config 與本機檔案，不引入網路傳輸。
- 不輸出 token/秘密值；輸出內容僅 directory/profile 與統計欄位。
- strict 僅改變流程控制（exit code），不增加權限。

## Open Questions

- 是否要在未來補 `--strict-level`，讓 apply 模式可選「只要有 pruned 也視為失敗」？
- 是否需要在 JSON 中補 `strictReason`（例如 `prunable-detected` / `skipped-detected`）以降低腳本判斷成本？
