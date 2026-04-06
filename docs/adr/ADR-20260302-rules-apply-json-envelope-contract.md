# ADR-20260302: `gitface rules apply` 導入 `--json-envelope` 統一契約

## Context

`gitface rules apply` 是自動化場景最常用的核心命令之一（resolve + use 一次完成），但目前機器輸出只提供 legacy `--json`，尚未接上統一 Result Envelope。這造成 automation 端需要為 `rules apply` 維護特例 parser，無法與 `use/current/list/completion` 共用 `status/code/errors/meta` 的契約驗證與觀測欄位。

Baseline（2026-03-02，本機）：

- `pnpm lint`：通過，`real 0.41s`
- `pnpm test`：通過，`19 files / 160 tests`，`real 14.60s`
- `pnpm build`：通過，`real 1.01s`
- Coverage：Statements `74.65%` / Branches `61.21%` / Functions `79.95%` / Lines `74.82%`

目前痛點：

- 業務邏輯分散點：`rules apply` action 同時承擔流程控制、狀態判斷與多種輸出分支（text/json），可讀性與可測性成本偏高。
- 輸出格式不一致點：`rules apply --json` 與現有 envelope 命令不一致，缺少 `code/errors/meta`。
- 高維護成本熱點：CI/agent 需要分支解析 `rules apply`，無法直接套用 envelope contract validator。

## Decision

本輪以相容增量方式導入 `rules apply --json-envelope`：

1. `rules apply` 新增 `--json-envelope`，保留既有 `--json` 與 text output 不變。
2. `--json-envelope` 成功/失敗皆輸出統一 Result Envelope：
   - 成功代碼：`RULE_APPLY_APPLIED`、`RULE_APPLY_DRY_RUN`、`RULE_APPLY_UNCHANGED`、`RULE_APPLY_UNMATCHED`
   - 錯誤代碼：`RULE_APPLY_SCOPE_INVALID`、`RULE_APPLY_FAILED`
3. 在 `rules` 輸出層新增 envelope mapper，將 action 的輸出決策集中為 `text/json/json-envelope` 三態路由。
4. 維持向後相容：不更動 legacy `--json` 欄位結構。

## Alternatives Considered

1. 直接把 `--json` 改為 envelope
- 優點：契約最快收斂成單一路徑。
- 缺點：會破壞既有腳本，風險過高。

2. 只加 `--json-envelope`，但沿用 action 內分散輸出分支
- 優點：改動最小、交付快。
- 缺點：輸出決策邏輯仍混雜在 action，後續擴充（例如 rules doctor/prune envelope）成本高。

3. 一次把 `rules` 全子命令（add/remove/resolve/doctor/prune/list/apply）都改為 envelope
- 優點：一致性最高。
- 缺點：單輪範圍過大，風險與回歸面過高，不符合本輪單一 MVP 原則。

## Consequences

正面：

- `rules apply` 納入統一 Result Envelope，CI/automation 可直接共用 parser、trace 與錯誤分類。
- 輸出映射集中，action 層只保留流程與業務判斷，降低維護成本。
- 保持向後相容，既有 `--json` 腳本可無痛延續。

負面與風險：

- 短期需要同時維護 legacy `--json` 與 `--json-envelope` 兩條輸出路徑。
- 若 envelope code 命名治理不一致，會增加後續跨命令整合成本。

遷移與回滾：

- 遷移：automation 可逐步把 `rules apply --json` 改為 `rules apply --json-envelope`。
- 回滾：可單一 commit 回退 `--json-envelope` 旗標與映射函式，不影響既有 text/`--json`。

## Rollout Plan

1. 新增 ADR 與輸出契約說明。
2. 在 `rules apply` 加入 `--json-envelope` 參數。
3. `rules apply` action 導入 output mode（text/json/json-envelope）與 `traceId/durationMs`。
4. 新增 rules apply envelope output mapper（success/error）。
5. 補 e2e contract tests（成功 + 驗證錯誤）。
6. 更新 README / CLI / 使用手冊。
7. 執行 `pnpm lint && pnpm test && pnpm build`。

## Test Plan

- E2E：
  - `gitface rules apply <dir> --json-envelope`：驗證 `status/code/data/errors/meta`。
  - `gitface rules apply <dir> --scope bad --json-envelope`：驗證 error envelope + exit code `1`。
- 回歸：
  - `gitface rules apply --json` 仍輸出既有 JSON shape。
  - `rules apply --strict` 行為與 exit code 不變。
- 品質檢查：`pnpm lint`、`pnpm test`、`pnpm build`。

## Observability

`rules apply --json-envelope` 會暴露：

- `meta.schemaVersion`：契約版本治理
- `meta.durationMs`：命令耗時
- `meta.traceId`：跨流程追蹤
- `code`：成功型態與錯誤分類

## Security/Privacy

- 不新增額外權限、網路或敏感檔案讀寫範圍。
- `traceId` 使用隨機 UUID，不含 token 或 PII。
- 輸出資料只含既有 profile/rule/apply 結果欄位，不擴張敏感面。

## Open Questions

- `rules` 其餘子命令（doctor/prune/resolve/add/remove）的 `--json-envelope` 收斂順序是否應以 CI 使用頻率排序？

## Business Logic Consolidation Plan

- 將 `rules apply` 的輸出決策集中為明確 `outputMode` 路由（text/json/json-envelope），減少 action 內輸出分支重複。
- 保持業務判斷（match/fallback/dry-run/unchanged）在 command action，輸出序列化集中於 output/ui 層。

## Output Contract Unification Plan

- `rules apply` 新增 `--json-envelope`，採共用 Result Envelope：
  `status`、`code`、`message`、`data`、`errors[]`、`meta.schemaVersion`、`meta.durationMs`、`meta.traceId`。
- `data` 保留 command-specific（rule/profile/current/changes），外層 envelope 與錯誤模型保持一致。
- 保留 `--json` 為過渡相容路徑；文件明確建議 automation 優先使用 `--json-envelope`。
- 同步更新 e2e contract tests 與文件。
- 本輪無 breaking change，不需 BC 文件。
