# ADR-20260302: `gitface import` 導入 `--json-envelope` 並集中匯入業務邏輯

## Context

`gitface import` 是批次資料寫入入口，涉及 `--overwrite`、`--dry-run`、`--atomic`、`--strict` 多重規則；但目前主要邏輯都在 `src/commands/import/action.ts`，造成 command 層同時承擔資料驗證、atomic precheck、逐筆匯入策略與輸出決策。這讓修改風險與測試成本上升。

同時，`import --json` 仍是舊版 summary shape，尚未接上統一 Result Envelope；CI/agent 端無法直接共用 `status/code/errors/meta` 契約與 trace 指標。

Baseline（2026-03-02，本機）：

- `pnpm lint`：通過，`real 0.48s`
- `pnpm test`：通過，`19 files / 162 tests`，`real 15.51s`
- `pnpm build`：通過，`real 1.33s`
- Coverage：Statements `74.30%` / Branches `61.40%` / Functions `79.28%` / Lines `74.45%`

目前痛點：

- 業務邏輯分散點：`import` command action 直接承載匯入核心規則（parse/precheck/atomic/strict）。
- 輸出格式不一致點：`import` 尚無 `--json-envelope`，與 `use/current/list/completion/rules apply` 不一致。
- 高維護成本熱點：若新增匯入規則或觀測欄位，需同時修改 action 與輸出，回歸面過大。

## Decision

本輪採「相容增量 + 核心邏輯收斂」：

1. 新增 `src/core/profile-import-service.ts`，集中 `import` 的核心規則：
   - payload 解析與候選驗證
   - atomic precheck 與 skipped 規則
   - dry-run / overwrite / normal import 執行
   - summary/result 建構
2. `src/commands/import/action.ts` 退回 orchestration：
   - 讀檔與 output mode 路由（text/json/json-envelope）
   - strict exit policy
   - 統一 envelope code mapping
3. `gitface import` 新增 `--json-envelope`：
   - 成功碼：`IMPORT_PROFILES_OK`、`IMPORT_PROFILES_PARTIAL`
   - 錯誤碼：`IMPORT_INPUT_INVALID`、`IMPORT_PROFILES_ATOMIC_ABORTED`、`IMPORT_PROFILES_STRICT_FAILED`
4. 保留 legacy `--json` 不變，維持向後相容。

## Alternatives Considered

1. 只補 `--json-envelope`，不移動核心邏輯
- 優點：改動小。
- 缺點：action 持續膨脹，維護成本與測試複雜度不降。

2. 直接把 `--json` 改成 envelope
- 優點：契約快速統一。
- 缺點：會破壞既有 automation parser，風險不可接受。

3. 一次重構 export/import 全流程契約
- 優點：資料交換路徑一次收斂。
- 缺點：單輪範圍過大，回歸成本高，不符合單輪單一 MVP 原則。

## Consequences

正面：

- 匯入規則集中至 core，command 層責任更清晰，降低後續改動成本。
- `import --json-envelope` 納入統一 machine-readable 合約，便於 CI/agent parser 重用。
- 保留 `--json` 相容路徑，不中斷既有腳本。

負面與風險：

- 短期需同時維護 `--json` 與 `--json-envelope` 兩種輸出。
- envelope code 若命名治理不足，可能造成跨 command 解讀不一致。

遷移與回滾：

- 遷移：automation 逐步改用 `gitface import <file> --json-envelope`。
- 回滾：可單獨回退 `--json-envelope` 與 `profile-import-service` 引用，不影響既有 text/`--json`。

## Rollout Plan

1. 新增 ADR 與 import envelope 契約說明。
2. 新增 `profile-import-service` 並搬移匯入核心規則。
3. `import` command 新增 `--json-envelope` 與三態輸出路由。
4. 補 unit/e2e 契約測試（core + envelope success/error）。
5. 更新 README、CLI、使用手冊。
6. 執行 `pnpm lint && pnpm test && pnpm build`。

## Test Plan

- Unit：
  - `profile-import-service` 驗證 payload parsing 與 atomic abort 行為。
- E2E：
  - `import --json-envelope` 部分失敗（非 strict）輸出 `IMPORT_PROFILES_PARTIAL`。
  - `import --atomic --json-envelope` precheck 失敗輸出 `IMPORT_PROFILES_ATOMIC_ABORTED` + exit `1`。
- 回歸：
  - `import --json` 既有 summary shape 不變。
  - `--strict` 在失敗時仍回傳 exit `1`。
- 品質：`pnpm lint`、`pnpm test`、`pnpm build`。

## Observability

`import --json-envelope` 提供：

- `meta.schemaVersion`：契約版本治理
- `meta.durationMs`：匯入耗時
- `meta.traceId`：跨流程追蹤
- `code`：成功/失敗分類（含 strict 與 atomic）

## Security/Privacy

- 未新增額外權限或網路存取。
- `traceId` 使用隨機 UUID，不含 token/PII。
- 輸出內容僅含 profile snapshot 與匯入結果，無額外敏感欄位。

## Open Questions

- `export` 是否應作為下一輪「資料交換路徑一致化」的下一站（補 `export --json-envelope` 與對應 contract tests）？

## Business Logic Consolidation Plan

- 將匯入規則（parse/validate/atomic/summary）集中於 `src/core/profile-import-service.ts`。
- command action 僅保留 I/O orchestration 與輸出路由，不再持有匯入核心決策。

## Output Contract Unification Plan

- `import` 新增 `--json-envelope` 並採共用 Result Envelope：
  `status`、`code`、`message`、`data`、`errors[]`、`meta.schemaVersion`、`meta.durationMs`、`meta.traceId`。
- `data` 保留 import-specific 欄位（`dryRun/total/imported/failed/results/file/strict/overwrite/atomic`）。
- 保留 `--json` 為相容過渡路徑；文件標示 automation 建議優先使用 `--json-envelope`。
- 同步更新 e2e tests 與文件。
- 本輪無 breaking change，不需 BC 文件。
