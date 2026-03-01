# ADR-20260301：為 import 增加 --atomic 全有或全無模式

## Context

目前 `gitface import <file>` 採逐筆匯入策略：遇到某筆失敗時，其它筆仍會持續寫入。這個行為在互動式使用可接受，但在 CI/批次同步場景會造成「部分成功」狀態，增加排錯與回滾成本。

本輪 baseline（2026-03-01）顯示品質閘門全綠：

- `pnpm run lint`：通過（約 1s）
- `pnpm run typecheck`：通過（約 1s）
- `pnpm run test`：133/133 通過（約 13s，coverage statements 73.6%）
- `pnpm run build`：通過（約 1s，`dist/index.mjs` 140.45 kB，gzip 27.55 kB）

痛點在於「匯入一致性」而不是現有測試穩定性：

- 使用者角度：一次匯入若含 1 筆壞資料，成功與失敗混雜，狀態不可預期。
- 維運角度：重跑腳本會遇到已存在衝突、需要人工清理，降低自動化可靠度。

## Decision

新增 `gitface import --atomic` 模式，提供「先全量預檢、再批次落地」的兩階段流程：

1. **預檢階段（不寫入）**
   - 逐筆解析資料格式。
   - 驗證 profile schema 與名稱合法性。
   - 驗證既有名稱衝突（考慮 `--overwrite`）。
   - 驗證 payload 內重複名稱（同一批次內不可重複）。
2. **提交階段（僅在預檢全通過時執行）**
   - 批次執行實際寫入。
3. **失敗語義**
   - 只要 `--atomic` 預檢有任一失敗，整批不寫入，並回傳非零 exit code。
   - JSON 結果中保留逐筆結果，且已通過預檢但被整批取消者標記為 failed 並附帶 skipped 訊息。

向後相容：未指定 `--atomic` 時，維持既有逐筆匯入語義。

## Alternatives Considered

1. **維持現況 + 只靠 `--strict`**
   - 優點：零開發成本。
   - 缺點：`--strict` 只能回報失敗，不保證不產生部分寫入。
2. **預設改為 atomic（不加旗標）**
   - 優點：一致性最好。
   - 缺點：屬行為破壞，可能影響既有依賴部分成功語義的使用者。
3. **先寫入後失敗再回滾（無預檢）**
   - 優點：概念上可達一致性。
   - 缺點：回滾路徑更複雜，失敗面更大；MVP 成本較高。

## Consequences

正面：

- 提升 CI/腳本可靠度，減少部分成功導致的髒狀態。
- 匯入結果可預期，重跑成本降低。

負面/風險：

- `--atomic` 會多一次預檢迴圈，匯入大檔案時 CPU/IO 成本略增。
- 結果訊息需清楚區分「驗證失敗」與「因 atomic 被跳過」。

遷移與維護成本：

- 無強制遷移，採 opt-in 旗標。
- 需維護兩種模式（逐筆與 atomic）的測試案例。

## Rollout Plan

1. 實作 `--atomic` 旗標與 import action 兩階段流程。
2. 新增 e2e：
   - atomic 失敗時不寫入任何 profile。
   - atomic 成功時完整寫入。
3. 文件更新：README + CLI reference。
4. 回滾策略：
   - 若上線後發現兼容性問題，移除/停用 `--atomic` 分支，不影響既有預設行為。

## Test Plan

- 單元/整合：沿用既有驗證流程（`parseImportCandidate` / `Profile.create` / `findProfile`）。
- E2E 新增：
  - `import --atomic` 有衝突時，檢查 exit code=1、結果顯示 skipped、資料未變更。
  - `import --atomic --overwrite` 成功匯入全部。
- 回歸：跑完整 `lint + typecheck + test + build`。

## Observability

- 以既有 summary/json 輸出為主觀測面。
- 關鍵指標：
  - atomic 匯入失敗率（`failed > 0`）
  - atomic 跳過筆數（`Skipped due to --atomic ...`）
  - `process.exitCode` 是否符合 CI gating 預期。

## Security/Privacy

- 不新增外部網路呼叫。
- 不改變 profile 儲存位置與權限模型。
- 錯誤訊息避免輸出敏感資訊，維持現有資料最小揭露策略。

## Open Questions

- 未來是否提供 `--atomic=rollback` 等進階模式（包含提交階段例外時的最佳努力回滾）？
- 是否在 JSON summary 增加 `mode: "atomic"` 欄位，方便下游系統直接識別？
