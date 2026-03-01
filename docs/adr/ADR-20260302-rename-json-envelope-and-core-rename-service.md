# ADR-20260302: `gitface rename` 導入 `--json-envelope` 並集中規則遷移邏輯

## Context

`gitface rename` 已支援 human mode 與 legacy `--json`，但與目前專案「統一 Result Envelope」與「業務邏輯集中到核心層」目標仍有落差：

1. `rename` 尚未提供 `--json-envelope`，CI/agent 需維護特例 parser，無法與 `use/current/list/import/export/doctor/completion/rules apply` 共用契約。
2. rename 的規則遷移邏輯（計算 `rulesToUpdate`、執行 rule migration）散落在 command action 層，導致 orchestration 與業務規則耦合。
3. `rename` 目前缺少 `meta.durationMs`、`meta.traceId` 與穩定錯誤碼，不利觀測與回放。

Baseline（2026-03-02，本機）：

- `pnpm -s lint`：通過，`real 0.43s`
- `pnpm -s typecheck`：通過，`real 1.13s`
- `pnpm -s test`：通過，`21 files / 173 tests`，`real 16.12s`
- `pnpm -s build`：通過，`real 1.18s`
- Coverage：Statements `75.16%` / Branches `62.43%` / Functions `80.31%` / Lines `75.32%`
- `rename` 區塊覆蓋率偏低：Statements `64.21%`

本輪痛點聚焦：

- 業務邏輯分散點：`src/commands/rename/action.ts` 直接處理 rule list/filter/migration。
- 輸出格式不一致點：`rename` 只有 legacy `--json`，缺共用 envelope 外層。
- 高維護成本熱點：自動化腳本需針對 `rename` 維護獨立錯誤解析路徑。

## Decision

本輪採用相容增量方案，完成 `rename` MVP：

1. 新增 `rename --json-envelope` 輸出模式，保留既有 `--json` 完全相容。
2. 新增核心服務 `ProfileRenameService`，集中：
   - dry-run 的 `rulesToUpdate` 計算；
   - rename 成功後的規則遷移。
3. command/action 僅保留 orchestration（輸出模式判斷、錯誤轉譯、exit code 控制）。
4. `--json-envelope` 導入統一 Result Envelope（`status/code/message/data/errors/meta`）與穩定錯誤碼。

Envelope code 規劃：

- `RENAME_PROFILE_OK`
- `RENAME_PROFILE_DRY_RUN`
- `RENAME_PROFILE_NOT_FOUND`
- `RENAME_PROFILE_CONFLICT`
- `RENAME_PROFILE_INVALID`

## Alternatives Considered

1. 直接把 `--json` 改為 envelope
- 優點：一次完全統一。
- 缺點：會破壞既有腳本，屬不必要 breaking change。

2. 只新增 `--json-envelope`，不搬移規則遷移邏輯
- 優點：開發最小。
- 缺點：command 層仍承載業務規則，維護成本高。

3. 把規則遷移邏輯合併到 `ProfileService`
- 優點：少一個 service 檔案。
- 缺點：`ProfileService` 職責持續膨脹，不利後續邊界管理。

## Consequences

正面：

- `rename` 可與其他命令共享統一契約 parser，CI/agent 可直接用 `code/errors/meta` 做判斷。
- 規則遷移邏輯從 command 層移到 core，提升可讀性與可測試性。
- 保持 `--json` 相容，不影響既有用戶腳本。

負面/風險：

- 短期同時維護 `--json` 與 `--json-envelope` 兩條 machine-readable 路徑。
- 新增 service 抽象，需避免後續重複抽象或責任漂移。

遷移：

- automation/CI 可逐步改用 `rename --json-envelope`，並保留 `--json` 作過渡。

回滾：

- 可單一 commit 回退 `--json-envelope` 與 `ProfileRenameService`；`--json` 與 text 行為可維持原樣。

## Rollout Plan

1. 新增 ADR（本文件）。
2. 建立 `src/core/profile-rename-service.ts`，集中 rename 規則遷移邏輯。
3. `rename` command 新增 `--json-envelope` 旗標與 envelope mapper。
4. 補齊 `rename --json-envelope` e2e 契約測試（success/error）。
5. 更新 README、`docs/cli.md`。
6. 執行 `pnpm -s lint && pnpm -s typecheck && pnpm -s test && pnpm -s build`。

## Test Plan

- E2E：
  - `rename old new --json-envelope`：回傳 success envelope（`RENAME_PROFILE_OK`）。
  - `rename missing new --json-envelope`：回傳 error envelope（`RENAME_PROFILE_NOT_FOUND`）且 exit code `1`。
- 回歸：
  - 既有 `rename --json` 行為與欄位維持不變。
  - 既有 rename rule migration e2e 維持通過。

## Observability

`rename --json-envelope` 新增可觀測資料：

- `meta.schemaVersion`：契約版本治理。
- `meta.durationMs`：單次 rename 流程耗時。
- `meta.traceId`：跨命令與 log 關聯追蹤。
- `code/errors[]`：可直接被 CI 告警規則消費。

## Security/Privacy

- 無新增網路請求或權限需求。
- `traceId` 使用隨機 UUID，不含 PII。
- 輸出內容僅包含既有 profile 與 rename 結果欄位，不擴增敏感資料面。

## Open Questions

- `clone/remove/new/edit/rename` legacy `--json` 是否在未來統一定義 deprecation timeline？

## Business Logic Consolidation Plan

- 將 rename 的核心規則遷移流程集中在 `ProfileRenameService`：
  - `previewRename`：集中 dry-run 規則影響計算。
  - `renameProfile`：集中 rename + rule migration。
- command 層只保留參數解析、輸出模式路由、錯誤映射與 exit code。

## Output Contract Unification Plan

- 新增 `rename --json-envelope`，套用共用 envelope schema：
  - `status`、`code`、`message`、`data`、`errors[]`、`meta.schemaVersion`、`meta.durationMs`、`meta.traceId`
- `data` 允許 rename-specific：
  - `result`、`oldName`、`newName`、`rulesUpdated`、`profile`
- 保留 legacy `--json` 相容；此輪不移除欄位、不做 breaking change。
- 同步更新 e2e contract tests 與文件範例。
- 本輪無 breaking change，不需 BC 文件。
