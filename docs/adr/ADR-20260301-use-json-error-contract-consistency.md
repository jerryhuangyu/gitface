# ADR-20260301: 統一 `gitface use --json` 錯誤輸出契約

## Context

GitFace 多數命令在 JSON 失敗路徑都使用一致欄位：

- `status: "error"`
- `reason: "<message>"`

但 `gitface use --json` 目前失敗輸出是 `{ "error": "..." }`，與其他命令契約不一致。這在自動化場景會帶來實際成本：

- CI/Agent 需要為 `use` 做例外解析分支。
- 機器判斷時無法直接沿用通用 `status/reason` 錯誤結構。
- 文件雖描述「會回傳 JSON 錯誤」，但未明確且一致地定義欄位。

本輪 baseline（2026-03-01，本機）：

- `pnpm run typecheck`：通過（real 1.02s）
- `pnpm run lint`：通過（Checked 90 files / real 0.32s）
- `pnpm run test`：通過（19 files / 145 tests，Duration 13.54s）
- `pnpm run build`：通過（`dist/index.mjs` 145.15 kB，gzip 28.50 kB）
- Coverage：Statements 73.98% / Branches 60.13% / Functions 79.53% / Lines 74.14%

## Decision

將 `gitface use --json` 失敗輸出改為與其他命令一致：

- 舊：`{ "error": "..." }`
- 新：`{ "status": "error", "reason": "..." }`

套用範圍包含 `use` 命令全部 JSON 失敗路徑：

- 無效 scope
- `--query` 無命中 / 多命中
- profile 不存在（含 suggestion）
- 無效 profile 名稱

MVP 僅調整 `use` 命令的錯誤 JSON 結構，不變更成功與 dry-run 的既有 JSON 格式。

## Alternatives Considered

1. 維持現狀（`use` 保持 `{ error }`）

- 優點：零風險、零改動。
- 缺點：持續增加 automation parser 分支與維護成本。

2. 反向把所有命令改成 `{ error }`

- 優點：也能達成一致。
- 缺點：破壞面過大、影響既有腳本與文件，不符合向後相容優先。

3. 兩種欄位並存（`{ status, reason, error }`）

- 優點：相容舊解析器。
- 缺點：長期契約模糊，會延後清理成本並增加文件複雜度。

## Consequences

正面：

- `use` 與其他命令 JSON 錯誤契約一致，降低 Agent/CI 解析分支。
- 文件可提供統一範式，改善可預期性。
- 測試可直接共用 `status/reason` 驗證模式。

負面：

- 若外部腳本硬編碼 `parsed.error`，需改為 `parsed.reason`。

風險與緩解：

- 風險：少量既有自動化相容性回歸。
- 緩解：文件明確標示變更；測試覆蓋主要錯誤路徑；可快速 revert 單一 commit。

## Rollout Plan

1. 新增/更新 `use` JSON 失敗輸出函式，改為 `status/reason`。
2. 調整 e2e 與 action 測試斷言。
3. 更新 README、CLI Reference、使用手冊中的 `use --json` 錯誤範例。
4. 執行 `typecheck/lint/test/build`。
5. 若發生回歸，revert 本輪 commit。

## Test Plan

- 單元/命令行為：
  - `runUseAction` 在 JSON 模式下錯誤輸出包含 `status: "error"` 與 `reason`。
- E2E：
  - `gitface use --query work --json` 多命中時輸出新結構。
  - 既有成功/unchanged/dry-run JSON 結構不變。
- 回歸：
  - 非 JSON human output 不變。
  - 其他命令不受影響。

## Observability

專案目前無內建 telemetry；本輪以 JSON 輸出與 exit code 作為觀測：

- `use_json_error_schema_valid_rate`（CI/e2e 解析成功率）
- `use_json_error_exit_code_nonzero_rate`

若後續導入 command-level metrics，可將 `use` 錯誤類型（invalid-scope / ambiguous-query / profile-missing）納入維度。

## Security/Privacy

- 本變更僅調整錯誤 JSON 結構，無新增 I/O 或網路行為。
- `reason` 內容沿用既有錯誤訊息，不新增敏感資訊暴露面。

## Open Questions

- 是否在下一輪提供短期相容層（例如同時輸出 `error`）並加上 deprecation 視窗？
- 是否制定跨命令 JSON 契約測試（shared schema tests）以避免未來再出現欄位漂移？
