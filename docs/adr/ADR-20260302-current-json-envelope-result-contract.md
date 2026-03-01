# ADR-20260302: `gitface current` 新增 `--json-envelope` 統一輸出契約

## Context

`gitface current` 是使用者與 CI/agent 驗證 Git 身分狀態的高頻入口（切換前檢查、切換後驗證、規則套用後確認）。目前此命令只有 `--json` 與人類可讀輸出，仍存在契約分裂：

1. `current --json` 的 success payload 沒有共用 envelope 外層，欄位語意與 `use/completion --json-envelope` 不一致。
2. `current --json` 的錯誤仍是 `{ status: "error", reason }` 特例，缺少 `code/errors/meta`。
3. 缺少 `meta.schemaVersion`、`meta.durationMs`、`meta.traceId`，造成 automation 的可觀測與回放能力不足。

Baseline（2026-03-02，本機）：

- `pnpm lint`：通過，`real 0.32s`
- `pnpm test`：通過，`19 files / 153 tests`，`real 14.55s`
- `pnpm build`：通過，`real 1.09s`
- Coverage：Statements `74.17%` / Branches `60.36%` / Functions `79.64%` / Lines `74.33%`

痛點盤點：

- 業務邏輯分散點：`current` 的輸出分流（text/json/error）與錯誤 payload 在 command UI 層分散定義，沒有與統一契約映射共構。
- 輸出格式不一致點：`use`、`completion` 已有 `--json-envelope`；`current` 仍需消費端額外維護 legacy parser。
- 高維護成本熱點：文件與測試必須同時描述多種錯誤模型，跨命令自動化無法共享 envelope 驗證器。

## Decision

在 `gitface current` 新增相容增量旗標：`--json-envelope`。

- 保留既有 `--json` 輸出不變（向後相容）。
- `--json-envelope` 採用共用 Result Envelope：
  - `status`
  - `code`
  - `message`
  - `data`
  - `errors[]`
  - `meta.schemaVersion`
  - `meta.durationMs`
  - `meta.traceId`
- `--json-envelope` 覆蓋本命令可預期分支：
  - success：`CURRENT_IDENTITY_RESOLVED`
  - invalid scope error：`CURRENT_SCOPE_INVALID`
- 當 `--json` 與 `--json-envelope` 同時出現時，優先 `--json-envelope`。

## Alternatives Considered

1. 直接把 `--json` 改為 envelope
- 優點：一次統一所有機器輸出。
- 缺點：破壞既有腳本相容性，風險高。

2. 維持現狀，不做 envelope
- 優點：零開發成本。
- 缺點：輸出契約繼續分裂，不利於 CI/agent 共用處理器。

3. 僅在現有 `--json` 加上 `schemaVersion`
- 優點：改動小。
- 缺點：無法統一錯誤模型與 observability 欄位，效益有限。

## Consequences

正面：

- `current` 能與 `use/completion` 共用 envelope 解析邏輯，降低 agent/CI 成本。
- 增加 `durationMs/traceId`，提升排障與回放能力。
- 不破壞既有 `--json` 使用者，風險可控。

負面與風險：

- CLI 新增旗標，文件與測試面需擴充。
- 使用者可能混淆 `--json` 與 `--json-envelope`；需明確文件指引。

遷移與回滾：

- 遷移：新自動化流程改用 `current --json-envelope`；舊流程可維持 `--json`。
- 回滾：可單一 commit 回退此功能，不影響既有 `--json`。

## Rollout Plan

1. 在 `current` command 新增 `--json-envelope` 旗標。
2. 在 `current` output 層新增 envelope success/error mapper。
3. action 導入輸出模式分流（text / json / json-envelope）。
4. 新增 e2e 測試（success + invalid scope error）。
5. 更新 README 與 CLI 文件。
6. 執行 `pnpm lint && pnpm test && pnpm build`。

## Test Plan

- E2E：
  - `gitface current --json-envelope` 回傳 success envelope（含 `data` 與 `meta`）。
  - `gitface current --scope workspace --json-envelope` 回傳 error envelope 並 exit code `1`。
- 回歸：
  - `gitface current --json` 與 `--scope ... --json` 既有輸出維持不變。

## Observability

`--json-envelope` 導入後可直接收集：

- `meta.schemaVersion`：契約版本治理。
- `meta.durationMs`：命令耗時監測。
- `meta.traceId`：跨 log trace 串接鍵。
- `code`：成功與錯誤分類。

## Security/Privacy

- 不新增權限、網路請求或外部依賴。
- `traceId` 為隨機 UUID，不包含 token/PII。
- `data` 僅輸出既有可見的 Git identity 欄位，不擴大資料面。

## Open Questions

- 下一輪是否擴大到 `doctor/import/export/list` 的 `--json-envelope`，並定義 legacy `--json` 的長期維運策略？

## Business Logic Consolidation Plan

- 將 `current` 命令的 envelope 成功/錯誤映射集中到單一 output helper，讓 action 保持流程編排（參數驗證、讀取 identity、分流輸出）。
- 後續命令可沿用同一模式，避免在 action 直接拼接 JSON。

## Output Contract Unification Plan

- 本輪在 `current` 新增 Result Envelope 路徑，沿用共用 schema：`status/code/message/data/errors/meta`。
- `meta.schemaVersion` 固定使用 `1.0.0`，新增欄位採向後相容策略。
- `--json` 保留為 legacy；`--json-envelope` 作為統一契約入口。
- 同步更新測試與文件確保契約可驗證。
- 本輪無 breaking change，不需 BC 文件。
