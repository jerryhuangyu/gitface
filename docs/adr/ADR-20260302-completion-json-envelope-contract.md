# ADR-20260302: completion profiles 新增統一 Result Envelope 輸出契約

## Context

GitFace 已逐步強化 machine-readable 輸出，但目前 `gitface completion profiles --json` 仍使用特例 payload：

```json
{ "topic": "profiles", "prefix": "wo", "limit": 1, "count": 1, "names": ["work-admin"] }
```

這與其他命令逐步建立的 `status/error` 慣例不一致，對 AI agent/CI 有三個問題：

1. 缺少一致的外層 envelope，整合端需要為 completion 命令維護特例解析。
2. 缺少 `schemaVersion`，無法明確治理契約演進。
3. 缺少 `durationMs/traceId`，不利於可觀測、可回放的自動化流程。

Baseline（2026-03-02，本機）：

- `pnpm lint`：通過（約 1s）
- `pnpm test`：通過（19 files / 145 tests，約 14s）
- `pnpm build`：通過（約 2s）
- Coverage：Statements `73.99%` / Branches `60.13%` / Functions `79.58%` / Lines `74.15%`

痛點盤點：

- 業務邏輯分散：completion 的輸出契約、錯誤處理與資料映射都在 command action，缺少可復用的輸出組裝層。
- 輸出格式不一致：`completion --json` 非 envelope；失敗時由通用錯誤處理輸出文字，不利於機器解析。
- 維護熱點：每個命令各自拼 JSON，schema 演進與 observability 欄位難以一致落地。

## Decision

新增 **相容增量** 模式：`gitface completion profiles --json-envelope`。

- 保留既有 `--json` 舊契約（向後相容）。
- `--json-envelope` 輸出統一 Result Envelope：
  - `status`
  - `code`
  - `message`
  - `data`
  - `errors[]`
  - `meta.schemaVersion`
  - `meta.durationMs`
  - `meta.traceId`
- 在 `--json-envelope` 模式下，參數驗證錯誤與不支援 topic 也回傳 envelope 錯誤模型（避免文字錯誤輸出分裂）。

MVP 僅針對 completion profiles；其他命令後續分批導入。

## Alternatives Considered

1. 直接改寫既有 `--json` 為新 envelope
- 優點：一次完成統一。
- 缺點：破壞相容，影響既有 shell completion 與腳本消費者。

2. 維持現狀不新增模式
- 優點：零實作成本。
- 缺點：輸出契約繼續分裂，AI/CI 可靠性與可觀測性無法提升。

3. 只新增 `schemaVersion` 到舊 payload
- 優點：改動小。
- 缺點：仍缺少統一錯誤模型與觀測欄位，收益有限。

## Consequences

正面：

- 提供不破壞既有使用者的統一 envelope 路徑。
- completion 輸出可帶 `traceId + durationMs`，提升自動化可觀測與除錯效率。
- 透過共用 envelope builder，降低後續命令導入成本。

負面與風險：

- CLI 增加一個新旗標，文件與測試維護範圍擴大。
- 部分使用者可能不清楚 `--json` 與 `--json-envelope` 差異，需要文件清楚標示。

遷移與回滾：

- 遷移：AI/CI 新流程優先改用 `--json-envelope`，舊腳本維持 `--json`。
- 回滾：revert 本次 commit 即可回復舊行為。

## Rollout Plan

1. 新增共用 envelope builder（schema/version/meta/error model）。
2. completion action 導入 `--json-envelope` 成功/失敗輸出。
3. 新增 e2e 測試覆蓋成功與錯誤 envelope。
4. 更新 README 與 CLI 文件。
5. 執行 `pnpm lint && pnpm test && pnpm build`。

## Test Plan

- E2E：
  - `completion profiles --json-envelope` 成功輸出包含 envelope 與資料欄位。
  - `--json-envelope --limit 0` 回傳錯誤 envelope 並 exit code `1`。
  - `completion <invalid-topic> --json-envelope` 回傳錯誤 envelope 並 exit code `1`。
- 回歸：
  - 既有 `--json` payload 完整維持。
  - 非 JSON 模式輸出維持。

## Observability

`--json-envelope` 內建：

- `meta.schemaVersion`: `1.0.0`
- `meta.durationMs`: 命令執行毫秒
- `meta.traceId`: 每次命令唯一 ID

可直接被 CI log parser 或 agent runtime 納入追蹤鍵。

## Security/Privacy

- 不增加網路傳輸或外部依賴。
- `traceId` 使用隨機 UUID，不含 PII 或 token。
- 輸出資料沿用既有 completion 結果，不擴大敏感資訊面。

## Open Questions

- 下一輪是否要把 `--json-envelope` 推廣到 `list/current/doctor/import/export`，並制定統一 deprecation timeline？

## Business Logic Consolidation Plan

- 將 envelope 組裝邏輯集中到共用核心模組，command action 僅保留流程編排。
- completion action 僅負責取得資料與模式分流，輸出映射下沉到專屬 output helper。

## Output Contract Unification Plan

- 本輪新增 envelope schema（`status/code/message/data/errors/meta`）於 completion 命令。
- 版本策略：`meta.schemaVersion = 1.0.0`；未來欄位擴充以向後相容為原則。
- 相容策略：保留 `--json` 舊契約，`--json-envelope` 為新契約導入通道。
- 同步更新測試與文件，確保契約可驗證且可發現。

