# ADR-20260228: Add machine-readable JSON output for `gitface export`

## Context

`gitface` 已為多數高頻命令提供 `--json`，但 `gitface export` 仍有一個自動化落差：

- `gitface export`（無 `file`）目前直接輸出 profile 陣列 JSON，適合管線輸入，但缺少狀態/計數等中繼資訊。
- `gitface export <file>` 目前只輸出人類可讀訊息（例如 `Exported 2 profiles...`），腳本若要取得結果必須解析文案。
- 在這輪 baseline（2026-02-28）中，測試與建置皆健康（`test` 35/35 pass，`build` 成功），但覆蓋率顯示低覆蓋區塊仍多，代表新功能需要以最小範圍補測並避免擴大風險。

使用情境：CI/腳本做 profile 備份、同步、審計時，需要可穩定解析的輸出契約，不該依賴終端文案。

## Decision

為 `gitface export` 新增 `--json` 旗標，提供一致且向後相容的機器可讀輸出。

1. CLI 介面
- 新增 `gitface export [file] --json`。
- 不帶 `--json` 的既有行為保持不變。

2. 成功輸出契約
- `gitface export --json`（未提供 `file`）輸出：
  - `{ "status": "exported", "count": <number>, "profiles": [...] }`
- `gitface export <file> --json`（提供 `file`）輸出：
  - `{ "status": "exported", "count": <number>, "file": "<path>" }`

3. 失敗輸出契約
- `--json` 模式下發生錯誤時，輸出：
  - `{ "status": "error", "reason": "<message>", "file": "<path?>" }`
- 失敗維持 exit code `1`。

4. 實作範圍（MVP）
- 僅改 `export` 命令與其 UI helper、e2e 測試與文件。
- 不重構共用 command error framework（保留給後續 refactor 議題）。

## Alternatives Considered

1. 維持現況（不新增 `--json`）
- 優點：零改動。
- 缺點：腳本在 `export <file>` 場景仍需解析文案，可靠性與可維護性差。

2. 改為 `export` 預設一律輸出 envelope（破壞性）
- 優點：統一格式、無需旗標。
- 缺點：破壞既有將純陣列 JSON 串接到下游的使用者流程，回滾成本高。

3. 一次重構所有命令錯誤處理/JSON 契約
- 優點：架構更完整。
- 缺點：範圍過大，不符合單輪 MVP；風險與 review 成本上升。

## Consequences

正面：
- `export` 與其他命令的 `--json` 體驗更一致。
- 自動化腳本可直接依 `status/count/file/reason` 判斷結果，降低 fragile parsing。
- 對既有非 `--json` 使用者無破壞。

負面與風險：
- 新增一組輸出契約需長期維護。
- `file` 欄位採原始輸入路徑（不強制 canonicalize），不同執行目錄可能需要呼叫端自行解讀。

遷移與回滾：
- 遷移：僅需在腳本中加上 `--json` 並解析固定欄位。
- 回滾：可直接移除 `--json` 分支並保留既有文案輸出。

## Rollout Plan

1. 階段一（本輪）
- 新增 `export --json` 成功/失敗輸出。
- 補 e2e 測試覆蓋 stdout 與 file 模式。
- 更新 README 與 `docs/cli.md`。

2. 階段二（下一輪候選）
- 盤點並抽出共用 JSON error helper，降低重複邏輯。

Feature flag/設定：
- 以顯式旗標 `--json` 控制，預設關閉。

回滾策略：
- 若發現相容性問題，先停用腳本端 `--json`，CLI 仍可用既有輸出。

## Test Plan

單元/整合/E2E：
- E2E 新增：
  - `gitface export --json` 應輸出 `status=count=profiles`。
  - `gitface export <file> --json` 應輸出 `status=count=file` 並正確寫檔。
- E2E 既有 export/import 流程仍須通過，確保向後相容。

回歸：
- 全量執行 `pnpm run lint && pnpm run typecheck && pnpm run test && pnpm run build`。

效能：
- 輸出 envelope 的序列化成本與既有 `JSON.stringify` 同級；若資料量極大再評估串流。

## Observability

- 指標：
  - JSON 成功率：`status=exported` vs `status=error`（由呼叫端或包裝腳本記錄）。
  - 匯出筆數：`count`（可作為資料規模與異常檢查）。
- log：
  - 既有 logger/command handling 保持；JSON mode 錯誤會同步輸出 `reason` 以利機器判讀。

## Security/Privacy

- `export` 本質會輸出使用者身份資料（gitName/email/signingKey）；`--json` 不新增資料類型，只改輸出包裝。
- 建議在 CI 使用最小權限儲存路徑與秘密管理，避免將輸出檔上傳至公開 artifact。

## Open Questions

1. 後續是否要在 `--json` 模式補 `schemaVersion` 欄位，以便長期演進？
2. 是否需要新增 `--compact`，減少大資料量輸出體積？
