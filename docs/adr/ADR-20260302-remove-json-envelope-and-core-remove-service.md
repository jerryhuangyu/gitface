# ADR-20260302: `gitface remove` 導入核心刪除服務與 `--json-envelope` 統一契約

## Context

`gitface rm/remove` 是高頻維護操作（清理過期 profile、腳本化重置、CI 前置清場）。目前雖有 `--json`，但仍有兩個核心問題：

1. 輸出契約未統一：`remove` 缺少 `--json-envelope`，相較 `use/current/list/import/export/rename/rules` 等命令，automation 需要維護特例 parser。
2. 業務邏輯分散：`--dry-run`、`--force`（missing profile 跳過）流程判斷散在 command action，核心層缺乏集中入口。

Baseline（2026-03-02，本機）：

- `pnpm lint`：通過，耗時約 `377ms`
- `pnpm test`：通過，`21 files / 179 tests`，耗時約 `16499ms`
- `pnpm build`：通過，耗時約 `1146ms`
- Coverage：Statements `75.18%` / Branches `62.85%` / Functions `80.26%` / Lines `75.35%`

目前痛點：

- 業務邏輯分散點：`remove` action 直接承擔 dry-run/force 行為判斷與錯誤分支，不利重用與測試聚焦。
- 輸出格式不一致點：`remove` 缺少 envelope，無 `meta.schemaVersion`/`durationMs`/`traceId`。
- 高維護成本熱點：README/CLI 文件與測試必須同時維護 legacy 特例，難以用共用 contract validator 驗證。

## Decision

本輪對 `gitface rm/remove` 做相容增量改進：

1. 新增 `--json-envelope` 旗標，輸出統一 Result Envelope：
   - `status`
   - `code`
   - `message`
   - `data`
   - `errors[]`
   - `meta.schemaVersion`
   - `meta.durationMs`
   - `meta.traceId`
2. 新增核心層 `ProfileRemoveService`，集中 remove 的主要流程：
   - `dry-run` 預覽
   - `remove` 實際刪除
   - `force + missing profile` 視為可成功跳過
3. 保留既有 `--json` 與文字輸出（向後相容）。
4. 若同時指定 `--json` 與 `--json-envelope`，以 `--json-envelope` 優先。

Envelope code 規劃：

- success:
  - `REMOVE_PROFILE_OK`
  - `REMOVE_PROFILE_DRY_RUN`
  - `REMOVE_PROFILE_SKIPPED`
- error:
  - `REMOVE_PROFILE_NOT_FOUND`
  - `REMOVE_PROFILE_INVALID`

## Alternatives Considered

1. 僅新增 `--json-envelope`，不調整核心服務
- 優點：改動最小。
- 缺點：業務邏輯仍留在 command 層，違反邏輯集中原則。

2. 直接把 `--json` 升級為 envelope（移除 legacy）
- 優點：契約最快統一。
- 缺點：破壞向後相容，腳本風險高。

3. 維持現狀
- 優點：零成本。
- 缺點：契約分裂持續，CI/agent 成本持續上升。

## Consequences

正面：

- `remove` 可與其他命令共用 envelope 解析流程，降低 automation 成本。
- `durationMs` + `traceId` 提升可觀測與回放能力。
- `ProfileRemoveService` 讓 command 回到 orchestration 角色，降低 action 複雜度。

負面與風險：

- CLI 旗標與輸出模式增加，文件與測試需同步擴充。
- `--json` 與 `--json-envelope` 雙軌期仍需維護兩種輸出。

遷移與維護成本：

- 舊腳本可維持 `--json` 不動。
- 新腳本建議切換到 `--json-envelope`，逐步收斂 parser。

## Rollout Plan

1. 新增 `ProfileRemoveService` 並改由 remove action 使用。
2. remove command 新增 `--json-envelope` 旗標與輸出分流。
3. 新增 envelope success/error mapper。
4. 補齊 e2e（success/dry-run/force-skip/error）。
5. 更新 README 與 CLI docs。
6. 執行 `pnpm lint && pnpm test && pnpm build`。

回滾策略：

- 若上線後發現 envelope 消費問題，可回滾單一 commit；既有 `--json` 行為不變，回滾風險低。

## Test Plan

- E2E：
  - `remove --json-envelope` success payload 驗證（含 `meta.*`）。
  - `remove --dry-run --json-envelope` success payload 驗證。
  - `remove missing --force --json-envelope` skipped payload 驗證。
  - `remove missing --json-envelope` error payload + exit code `1` 驗證。
- 回歸：
  - 既有 `remove --json` 與 text 輸出不變。

## Observability

`--json-envelope` 可直接提供：

- `meta.schemaVersion`：契約版本治理
- `meta.durationMs`：remove 耗時追蹤
- `meta.traceId`：跨層 log 關聯鍵
- `code`：成功/錯誤分類聚合

## Security/Privacy

- 不新增外部網路或額外權限。
- `traceId` 為隨機 UUID，不含 token/PII。
- 輸出資料仍限於既有 profile 欄位（name/gitName/email/signingKey）。

## Open Questions

- 下一輪是否將 `clone/new/edit` 同步補齊 `--json-envelope`，並制定 legacy `--json` 長期淘汰時程？

## Business Logic Consolidation Plan

- 新增 `src/core/profile-remove-service.ts`，將 remove/dry-run/force-skip 決策集中於核心層。
- remove command action 僅負責參數進入點、錯誤轉譯（含 suggestion）、與輸出模式路由。

## Output Contract Unification Plan

- 本輪將 `remove` 納入統一 Result Envelope 契約。
- schema 版本沿用 `1.0.0`，新增 envelope 屬相容增量。
- 保留 legacy `--json`；`--json-envelope` 作為統一契約入口。
- 同步更新 e2e contract 驗證與 README/CLI 文件。
- 本輪無 breaking change，不需 BC 文件。
