# ADR-20260302: `gitface use` 新增 `--json-envelope` 統一輸出契約

## Context

`gitface use` 是最核心且高頻的流程（使用者切換身份、CI/agent 套用 profile）。目前雖支援 `--json`，但仍與統一 Result Envelope 有落差：

1. `use --json` 輸出外層並非共用 `status/code/message/data/errors/meta`。
2. 無 `meta.schemaVersion`、`meta.durationMs`、`meta.traceId`，自動化可觀測性不足。
3. 錯誤模型仍為 `{ status: "error", reason }` 特例，與 `completion --json-envelope` 不一致。

Baseline（2026-03-02，本機）：

- `pnpm lint`：通過，`real 0.32s`
- `pnpm test`：通過，`19 files / 148 tests`，`real 13.92s`
- `pnpm build`：通過，`real 1.07s`
- Coverage：Statements `74.19%` / Branches `60.32%` / Functions `79.84%` / Lines `74.36%`

痛點盤點：

- 業務邏輯分散：`use` 的成功/失敗輸出契約與映射規則集中在 command output 的 legacy JSON 函式，難與其他命令共用。
- 輸出格式不一致：`completion` 已有 `--json-envelope`，`use` 尚未導入，agent 需維護多種解析分支。
- 維護成本熱點：文件、測試、CI parser 需同時理解 legacy payload 與 envelope 以外的特例。

## Decision

在 `gitface use` 新增 **相容增量旗標**：`--json-envelope`。

- 保留既有 `--json` 契約與輸出（向後相容）。
- `--json-envelope` 輸出統一 Result Envelope：
  - `status`（success/error）
  - `code`
  - `message`
  - `data`
  - `errors[]`
  - `meta.schemaVersion`
  - `meta.durationMs`
  - `meta.traceId`
- `--json-envelope` 覆蓋 `use` 全流程狀態：
  - `applied` / `dry-run` / `unchanged`（放在 `data.result`）
  - 參數與流程錯誤（統一 error envelope + exit code `1`）
- 若同時提供 `--json` 與 `--json-envelope`，以 `--json-envelope` 為優先輸出模式。

## Alternatives Considered

1. 直接把既有 `--json` 改成 envelope
- 優點：一次統一契約。
- 缺點：破壞向後相容，現有腳本可能即刻失效。

2. 維持現狀，不新增 envelope 模式
- 優點：零改動成本。
- 缺點：高頻 `use` 仍是契約分裂點，可觀測能力不足。

3. 只在 `--json` 增加 `schemaVersion`
- 優點：改動小。
- 缺點：仍缺 `code/errors/meta.traceId` 等統一結構，無法達到跨命令一致。

## Consequences

正面：

- `use` 可與 `completion` 共用 envelope 消費策略，降低 automation 解析成本。
- 提供 `durationMs/traceId`，改善可回放與除錯能力。
- 透過共用 `buildResultEnvelope`，契約治理更集中。

負面與風險：

- CLI 新增旗標，文件與測試面需擴張。
- 需明確說明 `--json`（legacy）與 `--json-envelope`（統一契約）差異。

遷移與回滾：

- 遷移：新 automation/CI 優先改用 `use --json-envelope`。
- 回滾：單一 commit 可回退，不影響舊 `--json` 使用者。

## Rollout Plan

1. `use` 指令加入 `--json-envelope` 旗標。
2. 在 `use` output 層新增 envelope success/error mapper。
3. action 導入輸出模式分流（text / json / json-envelope）。
4. 新增 e2e + action test 驗證 envelope 成功與錯誤。
5. 更新 README、CLI 參考與中文使用手冊。
6. 執行 `pnpm lint && pnpm test && pnpm build`。

## Test Plan

- E2E：
  - `gitface use work --json-envelope` 成功輸出 envelope（含 `meta`、`data.result=applied`）。
  - `gitface use --query work --json-envelope` 在多重命中時輸出 error envelope 並 exit code `1`。
- Action test：
  - invalid scope 走 error envelope，`code=USE_SCOPE_INVALID`。
- 回歸：
  - 既有 `use --json` 輸出維持不變。
  - 非 JSON 互動/非互動流程維持。

## Observability

`--json-envelope` 提供可直接收集的欄位：

- `meta.schemaVersion`：契約版本治理
- `meta.durationMs`：指令耗時
- `meta.traceId`：單次執行追蹤鍵
- `code`：結果分類（applied/dry-run/unchanged/error 子類）

## Security/Privacy

- 不增加權限、網路呼叫、外部依賴。
- `traceId` 使用隨機 UUID，不含 PII/token。
- `data` 僅包含既有 `use` 已可輸出的 profile 與變更資訊，不擴增敏感面。

## Open Questions

- 下一輪是否將 `list/current/doctor/import/export` 也導入 `--json-envelope`，並定義 legacy `--json` 長期維運策略？

## Business Logic Consolidation Plan

- 將 envelope 組裝與錯誤模型收斂到 `use/output.ts` + `core/result-envelope.ts`。
- `use/action.tsx` 僅保留流程控制（驗證、選擇 profile、套用），不再直接拼裝 envelope JSON。

## Output Contract Unification Plan

- 本輪新增 `use --json-envelope`，採共用 Result Envelope 與 `schemaVersion=1.0.0`。
- 相容策略：`--json` 保留；`--json-envelope` 作為統一契約入口。
- 同步更新測試與文件，確保契約可驗收、可回歸、可被 agent/CI 直接消費。
- 本輪無 breaking change，故不需 BC 文件。
