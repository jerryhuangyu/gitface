# ADR-20260301: 為 `gitface rules resolve` 新增 `--strict` 以支援 CI Gate

## Context

`gitface rules resolve [directory]` 已可回傳目錄命中的最終規則，並在 JSON 輸出中提供 `matchedRule` 與 `profileExists`。目前即使出現以下高風險狀況，指令仍維持成功退出（exit code `0`）：

- 目標目錄沒有任何規則命中（`status: "unmatched"`）
- 有規則命中，但命中的 profile 已不存在（`profileExists: false`）

這在人工除錯時可接受，但對 CI/Agent 驗證流程不足，因為流程無法單靠 exit code 判斷是否應中止。維運面常見痛點：

- 規則配置漂移（stale rule）不會自動阻擋自動化流程。
- 需額外自行解析 JSON 才能做 gate，增加腳本複雜度與錯誤率。
- 與 `gitface doctor --strict` 的「可選嚴格模式」設計不一致。

本輪 baseline（2026-03-01，本機）：

- `pnpm run lint`：通過，約 `312ms`
- `pnpm run typecheck`：通過，約 `1067ms`
- `pnpm run test`：通過，`17 files / 95 tests`，約 `3617ms`
- `pnpm run build`：通過，約 `1009ms`
- build 產物：`dist/index.js 108.80 kB (gzip 22.25 kB)`
- 覆蓋率：Statements `76.71%`、Branches `63.63%`、Functions `84.38%`、Lines `76.95%`

## Decision

為 `gitface rules resolve` 新增 `--strict` 選項，將「可疑但可解析」結果提升為可 gate 的退出碼語意。

1. CLI 介面

- 新增：`gitface rules resolve [directory] --strict`
- `--strict` 可與 `--json` 併用。
- 未提供 `--strict` 時，保持既有行為與退出碼不變（向後相容）。

2. 嚴格模式語意

- 當結果為 `unmatched` 時：設定 `process.exitCode = 1`
- 當結果為 `matched` 且 `profileExists === false` 時：設定 `process.exitCode = 1`
- 當結果為 `matched` 且 `profileExists === true` 時：維持成功退出碼

3. 輸出契約

- JSON payload 不新增破壞性欄位，沿用既有 `status/matchedRule/profileExists`。
- 嚴格模式僅改變退出碼，不改變 JSON schema，降低下游解析風險。

## Alternatives Considered

1. 永遠將 `unmatched` 或 `profileExists=false` 視為失敗（不提供 `--strict`）

- 優點：實作簡單、預設更保守
- 缺點：破壞既有腳本與互動式排障流程，向後相容風險高

2. 新增獨立子命令（例如 `rules verify`）專做嚴格驗證

- 優點：語意清楚、與查詢命令分離
- 缺點：命令面擴張、學習成本提高、邏輯重複

3. 僅在 JSON 新增 `strictViolation` 欄位，不改退出碼

- 優點：輸出資訊更完整
- 缺點：CI 仍需自行解析 payload，未解決「可直接 gate」的核心需求

## Consequences

正面：

- 讓 CI/Agent 能直接依退出碼判斷規則是否健康。
- 更快發現規則與 profile store 漂移問題，降低錯誤身份提交風險。
- 與 `doctor --strict` 的產品心智一致，降低使用成本。

負面與風險：

- 使用者若誤用 `--strict` 於探索流程，可能遇到更多非零退出。
- 需要維護新增測試與文件敘述，增加少量維護成本。

遷移與回滾：

- 低成本。預設行為不變，僅新增可選旗標。
- 若需回滾，可直接移除 `--strict` 相關程式與文件並 revert commit。

## Rollout Plan

1. 在 `rules resolve` 命令層新增 `--strict` 旗標。
2. 在 resolve action 增加嚴格模式判斷與退出碼設定。
3. 補 e2e：
   - strict + unmatched 應為 exit code `1`
   - strict + matched + missing profile 應為 exit code `1`
4. 更新 README、CLI reference、中文使用手冊。
5. 跑完整 quality gates（lint/typecheck/test/build）。
6. 若發生回歸，revert 本次 commit。

## Test Plan

- e2e 測試：
  - `rules resolve --strict --json` 在 `unmatched` 場景回傳 `status: "unmatched"` 且 exit code `1`。
  - `rules resolve --strict --json` 在 `profileExists: false` 場景維持 `matched` payload 且 exit code `1`。
- 回歸測試：
  - 既有 `rules resolve --json` 非 strict 場景保持 exit code `0`。
  - 既有 `rules add/remove/list` 行為不變。
- 品質閘道：
  - `pnpm run lint`
  - `pnpm run typecheck`
  - `pnpm run test`
  - `pnpm run build`

## Observability

關鍵可觀測訊號：

- `rules resolve --json` 的 `status/matchedRule/profileExists`（資料面）
- 是否為非零退出碼（控制面）

建議監控（CI 層）：

- `rules resolve --strict` 的失敗率
- 失敗分類：`unmatched` vs `profileExists=false`

目前專案無集中 telemetry，本輪以 e2e 契約與 CI exit code 作為主要觀測手段。

## Security/Privacy

- 未新增網路呼叫與額外權限。
- 輸出資料仍僅含目錄與 profile 名稱，不含 email 或 signing key。
- `--strict` 僅影響流程控制，不改變敏感資料面。

## Open Questions

- 是否需要在後續加入 `rules resolve --strict --json` 的失敗原因欄位（例如 `strictReason`）以減少 CI 腳本判斷邏輯？
- 是否要提供 `rules lint` 聚合檢查（一次掃描所有規則是否指向存在 profile）？
