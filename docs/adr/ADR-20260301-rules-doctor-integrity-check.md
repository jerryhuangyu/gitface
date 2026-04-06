# ADR-20260301: 新增 `gitface rules doctor` 規則健康檢查

## Context

GitFace 已經有 `rules add/remove/list/resolve/apply`，可以依目錄自動切換 profile；但目前缺少一個「批次檢查規則健康度」的入口。實務上常見兩種漂移情境：

- 規則仍存在，但 profile 已被刪除（`rules apply` 才會在執行當下失敗）。
- 規則綁定的目錄已不存在（搬移專案後遺留 stale includeIf 規則）。

這會讓使用者與 CI/Agent 只能被動在錯誤發生時才發現問題，缺乏可預防、可觀測、可 gate 的流程。

本輪 baseline（2026-03-01，本機）：

- `pnpm lint` 通過，耗時約 `290ms`
- `pnpm test` 通過，`17 files / 102 tests`，耗時約 `3691ms`
- `pnpm build` 通過，耗時約 `1360ms`
- Coverage：Statements `75.88%` / Branches `62.6%` / Functions `83.59%` / Lines `76.06%`
- Build 產物：`dist/index.js 117.75 kB (gzip 23.65 kB)`

## Decision

新增子命令：`gitface rules doctor`，提供規則完整性檢查（MVP 聚焦「可提前發現風險」）。

### 命令與選項

- `gitface rules doctor`
- `--json`：輸出機器可讀結果。
- `--strict`：只要有任何非 `pass` 項目即回傳 exit code `1`，用於 CI gate。

### 檢查內容（MVP）

逐一檢查所有規則（由 `rules list` 同一來源取得）：

- `profileExists`：規則引用的 profile 是否存在。
- `directoryExists`：規則目錄是否仍存在且為資料夾。

判定等級：

- `pass`：`profileExists=true` 且 `directoryExists=true`
- `warn`：`profileExists=true` 但 `directoryExists=false`
- `fail`：`profileExists=false`（不論目錄是否存在）

### 輸出契約

- 人類可讀模式：列出每條規則檢查結果 + summary。
- JSON 模式：固定輸出
  - `status`：`ok` 或 `issues`
  - `strict`
  - `summary`：`total/pass/warn/fail`
  - `results[]`：包含 `directory`、`profileName`、`status`、`profileExists`、`directoryExists`

### Exit code

- 預設：只有 `fail` 才 exit code `1`；純 `warn` 仍為 `0`。
- `--strict`：有 `warn` 或 `fail` 都 exit code `1`。

## Alternatives Considered

1. 不新增命令，僅靠 `rules apply/resolve --strict` 在使用時發現問題

- 優點：零開發成本。
- 缺點：屬於事後偵錯，無法做預防性巡檢與定期 gate。

2. 把規則檢查塞進既有 `gitface doctor`

- 優點：入口少。
- 缺點：`doctor` 目前聚焦環境/全域 Git，直接併入會讓輸出語意過寬，且難針對 rules 獨立演進。

3. 在 `rules list` 增加 `--verify` 旗標

- 優點：避免新增子命令。
- 缺點：`list` 從查詢命令變成診斷命令，責任邊界不清楚；對自動化語意不直觀。

## Consequences

正面：

- 使用者可在切換前先找出壞規則，降低 runtime 失敗。
- CI/Agent 可用 `rules doctor --strict` 直接做健康 gate。
- 提升規則功能可觀測性，為後續批次修復/自動清理打基礎。

負面與成本：

- 新增命令、UI、文件與測試維護面。
- 每次檢查會對每條規則做 profile 與檔案系統查詢，規則很多時會增加少量耗時。

遷移與回滾：

- 無資料遷移。
- 回滾策略：revert 本次 commit，即可回到既有行為。

## Rollout Plan

1. 新增 `rules doctor` 命令入口與 action。
2. 新增 rules doctor 的人類可讀/JSON 輸出。
3. 補 e2e（pass、warn、fail、strict exit code）。
4. 更新 README、`docs/cli.md`、`docs/user-manual.zh-TW.md`。
5. 跑 `pnpm lint && pnpm test && pnpm build`。

## Test Plan

- 單元測試：
  - 規則狀態判定（pass/warn/fail）與 summary 聚合邏輯。
- 整合 / E2E：
  - all-pass 場景輸出 `ok`。
  - profile 遺失場景輸出 `fail` 並預設 exit code `1`。
  - directory 遺失場景輸出 `warn`，預設 exit code `0`。
  - `--strict` 在 `warn` 或 `fail` 場景都回傳 exit code `1`。
  - `--json` 輸出結構穩定可解析。
- 回歸：
  - 既有 `rules add/remove/list/resolve/apply` 行為與輸出不變。
- 效能：
  - 以規則數量 `N` 驗證為線性掃描 `O(N)`，不引入高階複雜度退化。

## Observability

建議追蹤指標（可由 CLI JSON/exit code 蒐集）：

- `rules_doctor_status_count{status=pass|warn|fail}`
- `rules_doctor_fail_rate`（fail / total）
- `rules_doctor_warn_rate`（warn / total）
- `rules_doctor_strict_exit_nonzero_rate`

目前專案無內建 telemetry，先以 `--json` 與 exit code 作為 CI/agent 可觀測來源。

## Security/Privacy

- 不新增網路存取與外部依賴。
- 只讀取本機檔案系統與本地 profile store，不輸出 token/PII。
- 預設不修改任何 Git config（純檢查命令）。

## Open Questions

- 是否需要後續加上 `--fix`（自動移除失效規則）？
- 是否需要新增 `--only warn|fail` 篩選，支援大型規則集快速巡檢？
- 是否要在 `rules list --json` 回傳最近一次 doctor 狀態（需狀態儲存）？
