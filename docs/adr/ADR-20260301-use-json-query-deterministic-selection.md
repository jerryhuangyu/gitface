# ADR-20260301: `gitface use --json` 支援 query 選擇且維持可預期非互動行為

## Context

`gitface use` 已支援 `--query` 來在未提供 `<profile>` 時縮小候選範圍，但目前程式在 JSON 模式會先做以下早期判斷：

- `--json` 且未提供 `<profile>` 時立即失敗。

這造成行為衝突：

- `gitface use --query work --json` 即使只命中 1 個 profile，也無法執行。
- JSON 模式的自動化情境（CI/Agent/腳本）必須先額外呼叫 `list` 再回填 profile，增加流程成本與失敗點。
- 錯誤路徑在候選解析階段目前偏向 human message，不利機器處理。

本輪 baseline（2026-03-01，本機）：

- `pnpm run typecheck`：通過
- `pnpm run lint`：通過（Checked 90 files）
- `pnpm run test`：通過（19 files / 141 tests，Duration 13.56s）
- `pnpm run build`：通過（`dist/index.mjs` 145.16 kB，gzip 28.50 kB）
- Coverage：Statements 73.81% / Branches 60.05% / Functions 79.27% / Lines 73.97%

## Decision

調整 `gitface use` 的名稱解析順序與 JSON 契約：

1. `--json` 模式不再要求一定要直接提供 `<profile>`。
2. 當未提供 `<profile>` 時，先套用既有候選解析（含 `--query` 過濾）。
3. JSON 模式下維持 deterministic/non-interactive：
   - 候選為 0：回傳 JSON error（exit code 1）。
   - 候選為 1：直接自動套用。
   - 候選 > 1：回傳 JSON error（exit code 1），要求提供明確 `<profile>` 或更精準 `--query`。
4. JSON 模式下的候選解析失敗，統一輸出 machine-readable error（而非純人類訊息）。

MVP 範圍僅限 `use` 命令，不變更其他命令的 JSON 互動策略。

## Alternatives Considered

1. 維持現狀（JSON 必須提供 `<profile>`）

- 優點：零修改風險。
- 缺點：與 `--query` 能力衝突，自動化流程需額外串接命令。

2. JSON 模式也允許互動選單（TTY 時）

- 優點：功能最完整。
- 缺點：JSON 會混入互動流程，不利腳本可預測性；增加測試矩陣。

3. 新增專用旗標（例如 `--auto-select`）才允許 JSON 自動選取

- 優點：行為顯式。
- 缺點：增加心智負擔；使用者仍需學習額外旗標，收益有限。

## Consequences

正面：

- `use --query --json` 在唯一候選情境可一鍵完成，降低自動化流程步驟。
- JSON 模式錯誤輸出一致，便於 CI/Agent 解析與回應。
- 維持 JSON 非互動特性，降低不可預期輸入來源。

負面與成本：

- `use` 名稱解析分支增加，需要補齊 e2e 與邏輯測試。
- 既有文件需修正「JSON 必須提供 profile」敘述。

風險與回滾：

- 風險：使用者可能誤解 JSON 模式在多候選下為何不進互動。
- 緩解：錯誤訊息明確提示「提供 `<profile>` 或縮小 `--query`」。
- 回滾：revert 本輪 commit 可完整回復舊行為，無資料遷移。

## Rollout Plan

1. 調整 `use` 名稱解析流程，加入 JSON non-interactive gating。
2. 補上 e2e：
   - `--query --json` 唯一候選可成功套用。
   - `--json` 多候選回傳 JSON error。
3. 更新文件（README/CLI/User Manual）。
4. 執行 `typecheck/lint/test/build`。
5. 若回歸風險出現，先 revert 單一 commit。

## Test Plan

- 單元/行為：
  - JSON 模式下 `0/1/N` 候選分支行為正確。
  - JSON 模式不觸發互動 prompt。
- E2E：
  - `gitface use --query main --json` 命中單一候選時成功套用並輸出 JSON。
  - `gitface use --query work --json` 命中多候選時輸出 JSON error + exit code 1。
- 回歸：
  - `gitface use <profile>`、`--dry-run`、非 JSON 互動模式維持既有行為。

## Observability

目前專案無內建 telemetry；本輪以 CLI JSON 輸出與 exit code 作為觀測主體：

- `use_json_auto_select_success_count`（可由 e2e/CI 成功次數觀察）
- `use_json_ambiguous_fail_count`
- `use_json_exit_code_nonzero_rate`

後續若導入 metrics，可把上述指標接到 command-level instrumentation。

## Security/Privacy

- 只讀寫本機 Git config 與本機 profile store，無新增網路行為。
- 錯誤訊息僅包含 profile 名稱/查詢字串，不涉及 token 或敏感憑證。

## Open Questions

- 是否在未來提供 `--exact` 以避免模糊比對造成歧義？
- `rules apply --json` 是否也需要同等 deterministic selection 原則的統一規範？
