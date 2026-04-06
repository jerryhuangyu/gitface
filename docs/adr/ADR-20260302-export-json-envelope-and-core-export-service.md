# ADR-20260302: `gitface export` 導入 `--json-envelope` 並集中匯出核心邏輯

## Context

`gitface export` 是資料備份與跨環境遷移的核心入口，常被 CI/agent 用於備份快照與後續 `import` 回放。但目前只有 legacy `--json` 輸出（`status/count/file|profiles` 與錯誤 `status/reason`），尚未納入統一 Result Envelope（`status/code/message/data/errors/meta`）。

另外，`src/commands/export/action.ts` 目前同時處理 profile snapshot 映射、JSON 序列化、輸出模式判斷與錯誤輸出，業務邏輯仍留在 command 層，與「業務邏輯集中於 core」原則不一致。

Baseline（2026-03-02，本機）

- `pnpm lint`: 通過，`real 0.47s`
- `pnpm test`: 通過，`20 files / 166 tests`，`real 15.80s`
- `pnpm build`: 通過，`real 1.34s`
- Coverage: Statements `74.70%` / Branches `61.84%` / Functions `79.86%` / Lines `74.85%`

目前痛點：

- 業務邏輯分散點：`export action` 直接承載快照映射與序列化策略。
- 輸出格式不一致點：`export` 仍無 `--json-envelope`，與 `use/current/list/completion/rules apply/import` 不一致。
- 高維護成本熱點：當備份契約要新增 metadata 或錯誤碼時，需在 command 層同步調整，回歸風險高。

## Decision

本輪採「相容增量 + 核心邏輯收斂」：

1. `gitface export` 新增 `--json-envelope`：
- 成功碼：`EXPORT_PROFILES_STDOUT`、`EXPORT_PROFILES_WRITTEN`
- 失敗碼：`EXPORT_PROFILES_FAILED`、`EXPORT_WRITE_FAILED`
- envelope 包含 `meta.schemaVersion`、`meta.durationMs`、`meta.traceId`

2. 新增 `src/core/profile-export-service.ts`，集中匯出核心邏輯：
- profile -> snapshot payload 映射
- 匯出數量統計
- 匯出 JSON 文本序列化

3. `src/commands/export/action.ts` 退回 orchestration：
- output mode 路由（text/json/json-envelope）
- file I/O 與錯誤處理
- 透過 UI 層輸出統一 envelope

4. 保留既有 `--json` 輸出 shape，不做 breaking change。

## Alternatives Considered

1. 只加 `--json-envelope`，不建立 core export service
- 優點：改動最小。
- 缺點：command 層持續承載業務邏輯，無法降低維護成本。

2. 直接把 `--json` 改成 envelope
- 優點：契約一次收斂。
- 缺點：破壞既有腳本與整合，違反預設向後相容。

3. 本輪改做 `doctor` 或 `rules resolve` envelope
- 優點：同樣可補齊契約缺口。
- 缺點：`export` 是備份/回放主路徑，對 agent/CI 戰略價值更高，應優先。

## Consequences

正面：

- `export` 納入統一 envelope，CI/agent 可共用 parser 與告警分流。
- 匯出核心邏輯移至 core，command 層更單純、可測試性提升。
- legacy `--json` 保留，既有使用者不需立即遷移。

負面與風險：

- 需短期維護兩套 machine-readable 輸出（`--json` 與 `--json-envelope`）。
- envelope code 命名需持續治理，避免跨命令語意漂移。

遷移與回滾：

- 遷移：自動化流程逐步改用 `gitface export --json-envelope`。
- 回滾：可單獨移除 `--json-envelope` 路徑與 UI mapper，不影響 text/legacy `--json`。

## Rollout Plan

1. 新增 ADR 與文件範例。
2. 建立 `profile-export-service`，搬移匯出映射/序列化規則。
3. `export` command 新增 `--json-envelope` 並接入 envelope success/error mapper。
4. 補 e2e contract 測試（stdout 成功、file 成功、file error）。
5. 執行 `pnpm lint && pnpm test && pnpm build`。

## Test Plan

- Unit：
- `profile-export-service` 驗證 snapshot 映射與 JSON 序列化。

- E2E：
- `export --json-envelope`（stdout）輸出 `EXPORT_PROFILES_STDOUT`。
- `export <file> --json-envelope` 輸出 `EXPORT_PROFILES_WRITTEN`。
- `export <invalid-path> --json-envelope` 輸出 `EXPORT_WRITE_FAILED` 並設定 exit code `1`。

- 回歸：
- `export --json` 與 `export <file> --json` 既有 shape 維持不變。
- 非 JSON 模式仍維持現有人類可讀輸出。

## Observability

`export --json-envelope` 提供：

- `meta.schemaVersion`：契約版本治理
- `meta.durationMs`：匯出流程耗時
- `meta.traceId`：跨步驟追蹤
- `code`：區分 stdout/file success 與寫檔失敗

## Security/Privacy

- 不新增網路與權限需求。
- `traceId` 為隨機 UUID，不含 token/PII。
- envelope `data` 僅包含 profile snapshot 與輸出目標資訊，不新增額外敏感欄位。

## Open Questions

- 下一輪是否優先補齊 `doctor` 的 `--json-envelope`，完成健康檢查路徑的契約統一？

## Business Logic Consolidation Plan

- 將匯出資料映射與序列化規則集中到 `src/core/profile-export-service.ts`。
- `export action` 僅保留讀取 profiles、檔案寫入與 output routing。

## Output Contract Unification Plan

- `export` 新增 `--json-envelope` 並採共用 Result Envelope 外層：
  `status`、`code`、`message`、`data`、`errors[]`、`meta.schemaVersion`、`meta.durationMs`、`meta.traceId`。
- `data` 保留 export-specific 欄位（`count`、`file?`、`profiles?`）。
- 保留 `--json` 為相容過渡路徑；文件標示 automation 建議優先使用 `--json-envelope`。
- 同步更新 e2e/contract tests 與 README/CLI/使用手冊。
- 本輪無 breaking change，不需 BC 文件。
