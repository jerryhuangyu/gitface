# ADR-20260302: `gitface list` 導入 `--json-envelope` 並集中查詢邏輯

## Context

`gitface list` 是使用者與 automation 檢視 profile 狀態的主要入口，但目前存在兩個長期成本問題：

1. 機器輸出只有 legacy `--json` 陣列，沒有統一 Result Envelope（缺少 `code/errors/meta`）。
2. 排序、查詢、limit 等列表業務規則放在 command action 層，與核心服務層分散。

Baseline（2026-03-02，本機）：

- `pnpm lint`：通過，`real 0.32s`
- `pnpm test`：通過，`19 files / 155 tests`，`real 14.69s`
- `pnpm build`：通過，`real 1.07s`
- Coverage：Statements `74.32%` / Branches `60.64%` / Functions `79.80%` / Lines `74.49%`

目前痛點：

- 業務邏輯分散點：`list` 的排序/過濾/上限規則集中在 `src/commands/list/action.tsx`，不利重用與測試。
- 輸出格式不一致點：`use`、`current`、`completion profiles` 已支援 `--json-envelope`，`list` 仍是裸陣列 JSON。
- 高維護成本熱點：自動化工具需為 `list` 維護特例 parser，無法共享 envelope 驗證與追蹤欄位。

## Decision

本輪在 `gitface list` 採用「相容增量」方案：

1. 新增 `--json-envelope`，維持 `--json` 與 human output 不變。
2. `--json-envelope` 成功/失敗都使用統一 Result Envelope。
   - success code：`LIST_PROFILES_OK`
   - validation error code：`LIST_SORT_INVALID`、`LIST_LIMIT_INVALID`
3. 將列表查詢規則（query/sort/limit）集中到 `ProfileService` 新增查詢方法，command 層只做：
   - 參數字串解析/驗證
   - 輸出模式路由（text/json/json-envelope）
   - UI rendering

## Alternatives Considered

1. 直接把 `--json` 改成 envelope
- 優點：單一路徑最整齊。
- 缺點：破壞既有腳本，風險高。

2. 只加 `--json-envelope`，不搬移查詢邏輯
- 優點：改動最小。
- 缺點：業務規則仍留在 command 層，後續擴充/測試成本高。

3. 新增獨立 Query Service 檔案（不動 `ProfileService`）
- 優點：可保持 `ProfileService` 精簡。
- 缺點：短期增加抽象層與檔案數；此輪 MVP 不需要。

## Consequences

正面：

- `list` 與既有 envelope 命令契約一致，CI/agent 可重用 parser 與可觀測欄位。
- 列表規則集中到 core，降低 command action 複雜度與重複風險。
- 保持向後相容，既有 `list --json` 腳本不需改動。

負面與風險：

- 同時維護 `--json` 與 `--json-envelope` 兩條輸出路徑，文件與測試需同步。
- 新方法若被濫用，可能讓 `ProfileService` 過胖；需持續控管責任邊界。

遷移與回滾：

- 遷移：automation/CI 可逐步改用 `list --json-envelope`。
- 回滾：可單一 commit 回退 `--json-envelope` 與查詢方法，不影響 legacy `--json`。

## Rollout Plan

1. 新增 ADR 與輸出契約說明。
2. 在 `list` command 新增 `--json-envelope` 旗標。
3. 將 query/sort/limit 規則搬到 `ProfileService` 查詢方法。
4. 新增 `list` envelope output mapper（success/error）。
5. 補齊 e2e + unit/contract 測試。
6. 更新 README / CLI / 使用手冊文件。
7. 執行 `pnpm lint && pnpm test && pnpm build` 驗證。

## Test Plan

- E2E：
  - `gitface list --json-envelope`：成功 envelope，驗證 `code/data/meta`。
  - `gitface list --json-envelope --limit 0`：error envelope + exit code `1`。
  - `gitface list --json-envelope --sort latest`：error envelope + exit code `1`。
- Unit：
  - `ProfileService` 查詢方法驗證 query/sort/limit 規則與穩定排序。
- 回歸：
  - `gitface list --json` 仍輸出原本 JSON array。
  - 既有 TTY/non-TTY human output 行為不變。

## Observability

`list --json-envelope` 導入後可直接收集：

- `meta.schemaVersion`：契約版本治理
- `meta.durationMs`：列表耗時監測
- `meta.traceId`：跨流程追蹤
- `code`：成功/驗證錯誤分類

## Security/Privacy

- 不新增網路存取或額外權限。
- `traceId` 為隨機 UUID，不含 token/PII。
- `list` 僅輸出既有 profile 欄位，資料面不擴張。

## Open Questions

- 後續是否將 `new/edit/clone/rename/remove/export/import/doctor/rules` 也逐步補齊 `--json-envelope`，並定義 legacy `--json` deprecation 時程？

## Business Logic Consolidation Plan

- 將 `list` 的 query/sort/limit 規則集中至 `ProfileService`，讓 command/action 僅負責參數與流程編排。
- 保留顯示層（TTY/non-TTY 與 JSON 序列化）在 command/output 層，避免 core 依賴 UI。

## Output Contract Unification Plan

- `list` 新增 `--json-envelope`，套用共用 Result Envelope schema：
  `status/code/message/data/errors/meta`.
- `meta.schemaVersion` 使用 `1.0.0`；後續欄位擴充採向後相容策略。
- `--json` 保留 legacy 行為；`--json-envelope` 作為統一契約入口。
- 同步更新 docs 與 contract/e2e tests 保證輸出可驗證。
- 本輪無 breaking change，不需 BC 文件。
