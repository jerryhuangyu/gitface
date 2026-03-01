# ADR-20260302: rules add/remove/resolve 導入統一 Result Envelope 輸出契約

## Context

- 目前 `gitface rules` 子命令的 machine-readable 輸出契約不一致：
  - `rules apply` 已支援 `--json-envelope`，可輸出統一 envelope（含 `schemaVersion/durationMs/traceId`）。
  - `rules add/remove/resolve` 仍僅支援 `--json`，且欄位語意依命令各自定義（例如 `status: "added" | "removed" | "matched"`）。
- 這種分裂會增加 automation/CI 解析成本，也降低可觀測性（缺少標準化 `code` 與 `traceId`）。
- Baseline（2026-03-02）：
  - `pnpm lint` ✅
  - `pnpm typecheck` ✅
  - `pnpm test` ✅（175 tests）
  - `pnpm build` ✅
  - 測試耗時約 15.29s（Vitest 報告）

痛點對應：
1. 輸出格式不一致：`rules` 內部仍有命令未採用 envelope。
2. 業務邏輯分散：action 層同時處理流程、錯誤碼與輸出分支，契約映射沒有集中。
3. 高維護成本：每新增 machine-readable 行為時，需在多處重複實作狀態碼與錯誤格式。

## Decision

在本輪 MVP 中，對 `rules add/remove/resolve` 新增 `--json-envelope` 支援，並採用統一 Result Envelope：

- 外層固定：`status`、`code`、`message`、`data`、`errors[]`、`meta.schemaVersion`、`meta.durationMs`、`meta.traceId`。
- 保留既有 `--json` 輸出，維持向後相容。
- 將 envelope 序列化與成功/錯誤碼映射集中在 `src/commands/rules/ui.ts`，action 層只做流程編排與輸出模式選擇。

新增成功/失敗 code（範例）：
- `RULE_ADD_OK` / `RULE_ADD_DRY_RUN` / `RULE_ADD_FAILED`
- `RULE_REMOVE_OK` / `RULE_REMOVE_DRY_RUN` / `RULE_REMOVE_FAILED`
- `RULE_RESOLVE_MATCHED` / `RULE_RESOLVE_UNMATCHED` / `RULE_RESOLVE_FAILED`

## Alternatives Considered

1. 只維持 `--json`，不新增 envelope
- 優點：開發成本最低。
- 缺點：延續契約分裂，automation 無法獲得一致的 `traceId`/`code`。

2. 一次為 `rules` 全部子命令（含 list/doctor/prune）補齊 envelope
- 優點：一次完成所有統一工作。
- 缺點：本輪風險與範圍偏大，驗證面積過廣，不符合單輪只做最重要改進的節奏。

3. 先在 action 層各自組 envelope，不調整 UI 層
- 優點：改動看似直接。
- 缺點：輸出邏輯分散，後續重構成本更高。

## Consequences

正面：
- `rules` 子命令在高頻 mutation/resolve 路徑取得一致 envelope，CI/agent 可統一解析。
- 錯誤模型一致化，便於告警分類與重試策略。
- output mapping 更集中，降低未來改 schema 的維護成本。

負面/風險：
- 程式碼分支增加（`text/json/json-envelope` 三模）。
- 需新增 E2E 以避免 regression。

相容性：
- 非 breaking change；既有 `--json` 與文字輸出維持不變。

## Rollout Plan

1. 新增 `rules add/remove/resolve` CLI 參數 `--json-envelope`。
2. 在 `rules/ui.ts` 實作對應 envelope writer（成功/錯誤）。
3. Action 層加入 output mode resolve（text/json/json-envelope）。
4. 增加 E2E 驗證成功與失敗路徑（含 exit code）。
5. 更新 `README.md`、`docs/cli.md`、`docs/user-manual.zh-TW.md` 範例與說明。

回滾策略：
- 若觀察到自動化相容問題，可先回退 `--json-envelope` 新選項與對應測試/文件，既有 `--json` 不受影響。

## Test Plan

- 單元/整合：沿用既有 rules command 測試基礎。
- E2E 新增：
  - `rules add --json-envelope` 成功 payload 與 meta 欄位。
  - `rules add --json-envelope` missing profile 錯誤 payload + exit code `1`。
  - `rules remove --json-envelope`（含 dry-run）payload。
  - `rules resolve --json-envelope` matched/unmatched payload。
- 全量品質檢查：`pnpm lint && pnpm typecheck && pnpm test && pnpm build`。

## Observability

- 每次 `--json-envelope` 回應輸出 `meta.traceId` 供 CI/agent 串接。
- `meta.durationMs` 提供 command 級延遲量測。
- `code` 提供可聚合的結果分類（成功類型/錯誤類型）。

## Security/Privacy

- 僅輸出既有規則與 profile 名稱、目錄資訊，不新增 token/PII 類欄位。
- 維持最小揭露原則，不輸出敏感憑證內容。

## Open Questions

- 是否下一輪將 `rules doctor/prune/list` 也升級為 `--json-envelope`，完成 `rules` 全域契約統一。

## Business Logic Consolidation Plan

- 將 `rules add/remove/resolve` 的 envelope 映射集中至 `src/commands/rules/ui.ts`。
- action 檔僅保留：輸入校驗、服務呼叫、流程分支、exit code 決策。
- 避免在 action 檔內自行拼接 envelope JSON。

## Output Contract Unification Plan

- 本輪把 `rules add/remove/resolve` 的 machine-readable 新增到統一 Result Envelope（schemaVersion `1.0.0`）。
- 保留舊 `--json`（向後相容），文件明確建議 automation 優先採用 `--json-envelope`。
- 同步更新：CLI 選項、E2E contract tests、README/CLI/manual 文件。
- 非 breaking change，本輪不需 BC 文件。
