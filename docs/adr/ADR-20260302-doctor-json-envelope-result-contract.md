# ADR-20260302: `gitface doctor` 新增 `--json-envelope` 統一輸出契約

## Context

`gitface doctor` 是 CI/agent 常用的健康檢查入口，負責判斷 Git 環境、Profile Store 與全域身分是否可用。現況雖有 `--json`，但仍與既有 Result Envelope 路線分裂：

1. `doctor --json` 缺少共用 envelope 外層（`status/code/message/data/errors/meta`），無法和 `use/current/list/import/export/completion` 共享 parser。
2. 嚴格模式（`--strict`）是否失敗只能靠 `hasWarnings/hasFailures + exit code` 推斷，缺少穩定錯誤碼與錯誤陣列，CI 規則不易統一。
3. 沒有 `meta.durationMs` 與 `meta.traceId`，降低可觀測、回放與跨命令 trace 串接能力。

Baseline（2026-03-02，本機）：

- `pnpm lint`：通過，約 `1s`
- `pnpm typecheck`：通過，約 `1s`
- `pnpm test`：通過，`21 files / 171 tests`，約 `15s`
- `pnpm build`：通過，約 `1s`
- Coverage：Statements `74.93%` / Branches `62.08%` / Functions `80.09%` / Lines `75.09%`

痛點（本輪關注）：

- 業務邏輯分散點：`doctor` 的輸出與錯誤語意目前是命令內特例，未映射到共用契約模型。
- 輸出格式不一致點：同為 machine-readable，`doctor --json` 與其他 envelope 命令結構不同。
- 高維護成本熱點：CI/agent 需針對 `doctor` 額外寫一套解析與告警規則。

## Decision

在 `gitface doctor` 新增 `--json-envelope`，並維持 `--json` 完全向後相容。

- 新增輸出模式：`text` / `json` / `json-envelope`。
- 當 `--json` 與 `--json-envelope` 同時出現時，優先 `--json-envelope`。
- `--json-envelope` 使用共用 Result Envelope，並定義穩定錯誤碼：
  - success：`DOCTOR_CHECKS_OK`
  - error（有 fail，或 strict 下有 warn）：`DOCTOR_CHECKS_FAILED`
- envelope `data` 結構：
  - `strict`
  - `hasFatalChecks`
  - `summary.total/pass/warn/fail`
  - `checks[]`
- envelope `errors[]`：僅收斂 fatal checks（fail；以及 strict 模式下的 warn）。

## Alternatives Considered

1. 直接把 `--json` 改成 envelope
- 優點：一次統一。
- 缺點：破壞既有腳本，屬不必要 breaking change。

2. 維持現況，只保留 `--json`
- 優點：零開發成本。
- 缺點：契約分裂持續，CI/agent 無法收斂。

3. 僅在 `--json` 補 `code` 欄位
- 優點：改動最小。
- 缺點：仍缺少 `errors/meta`，無法對齊 Result Envelope。

## Consequences

正面：

- `doctor` 可與其他命令共享 envelope parser 與告警路由。
- CI 可直接以 `status/code/errors` 判定結果並落地觀測。
- 保留 legacy `--json`，相容風險低。

負面/風險：

- 文件與測試矩陣增加（`--json` + `--json-envelope`）。
- `doctor` 仍存在雙軌輸出，短期維護負擔略增。

遷移/回滾：

- 遷移：CI/agent 新流程改用 `doctor --json-envelope`。
- 回滾：單一 commit 回退 `--json-envelope` 即可，不影響既有 `--json`。

## Rollout Plan

1. 在 doctor CLI 增加 `--json-envelope` 旗標。
2. 新增 doctor envelope output mapper（success/error）。
3. action 導入 output mode + `durationMs/traceId`。
4. 增加 e2e 契約測試（success + strict failure）。
5. 更新 README / `docs/cli.md`。
6. 執行 `pnpm lint && pnpm typecheck && pnpm test && pnpm build`。

## Test Plan

- E2E：
  - `doctor --json-envelope`（有全域 identity）回傳 success envelope，`errors=[]`。
  - `doctor --strict --json-envelope`（缺全域 identity）回傳 error envelope，且 exit code `1`。
- 回歸：
  - 既有 `doctor --json` 測試維持通過。
  - 既有 `doctor` human mode / strict 行為維持不變。

## Observability

新增/強化可觀測欄位：

- `meta.schemaVersion`：契約版本治理。
- `meta.durationMs`：健康檢查總耗時。
- `meta.traceId`：與內部 logger/執行流程串接。
- `code` 與 `errors[]`：可被 CI 告警規則直接消費。

## Security/Privacy

- 無新增外部權限、網路請求、敏感依賴。
- `traceId` 為隨機 UUID，不含 PII。
- 輸出資料僅含既有 doctor check 訊息，不新增 token/secret 暴露面。

## Open Questions

- 是否在後續版本對 legacy `--json` 統一標示為過渡模式，並定義淘汰時程？

## Business Logic Consolidation Plan

- 將 doctor 的 machine-readable 契約映射集中在 `commands/doctor/ui.ts`，action 只保留流程編排（執行檢查、決定輸出模式、設定 exit code）。
- 以 summary/fatal 判定邏輯集中計算，避免不同輸出分支重複判斷。

## Output Contract Unification Plan

- doctor 新增 `--json-envelope` 採共用 envelope schema（`status/code/message/data/errors/meta`）。
- `meta.schemaVersion` 使用 `1.0.0`；後續新增欄位採向後相容。
- 保留 `--json` 作 legacy，相容現有腳本。
- 同步更新 e2e contract test 與文件範例。
- 本輪無 breaking change，不需 BC 文件。
