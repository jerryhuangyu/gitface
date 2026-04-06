# ADR-20260301：為 `rules list` 增加健康狀態檢視

## Context

目前 `gitface rules list` 只能列出 `directory -> profileName` 對映，當規則數量變多時有兩個實際痛點：

1. 維運排查需要在 `rules list` 與 `rules doctor` 間來回切換，人工比對成本高。
2. 腳本流程若想同時拿到「規則清單 + 健康狀態」，必須串接多個命令並自行 join 資料，容易出錯。
3. 目前 list 輸出不包含完整性資訊（profile 是否存在、directory 是否存在），UX 上無法一次看出風險規則。

本輪 baseline（2026-03-01，本地）

- `pnpm lint`：通過，`real 1.43s`
- `pnpm test`：通過，`129 passed`，`real 10.35s`
- `pnpm build`：通過，`dist/index.js 138.89kB (gzip 27.37kB)`，`real 6.19s`
- 規則相關流程已有 `doctor/prune` 完整性掃描能力與併行參數，但 `list` 尚未重用這些能力。

## Decision

新增 `rules list` 的健康檢視模式，MVP 決策如下：

1. 新增 `--health` 旗標：
   - 啟用後在列出規則時，同步掃描每條規則的 `profileExists` 與 `directoryExists`。
   - 每條規則新增 `status`：`pass` / `warn` / `fail`。
2. 新增 `--concurrency <number>`（僅在 `--health` 模式生效）：
   - 掃描併行度預設沿用完整性掃描預設值。
3. JSON 輸出在 `--health` 模式下改為結構化報告：
   - `rules`：含健康欄位的規則列表
   - `summary`：`total/pass/warn/fail`
   - `metrics`：掃描併行與耗時指標
4. 文字輸出在 `--health` 模式下：
   - 每行顯示狀態標記
   - 額外輸出摘要與掃描 metrics
5. 未指定 `--health` 時維持既有輸出行為，確保向後相容。

## Alternatives Considered

1. 維持現狀（只保留 `rules doctor`）

- 優點：零改動、相容風險最低。
- 缺點：清單檢視與健康檢查分離，使用者需要額外心智與腳本拼接成本。

2. 在既有 `rules list --json` 直接加入健康欄位（不加旗標）

- 優點：功能可直接被所有消費者使用。
- 缺點：破壞既有 JSON 契約風險高，可能影響依賴舊格式的自動化。

3. 另外新增 `rules list-health` 子命令

- 優點：語意清楚、格式可自由設計。
- 缺點：命令面增加、學習成本與維護成本更高，與既有 list 功能重疊。

## Consequences

正面：

- 使用者可在單一命令完成「規則盤點 + 風險定位」。
- 自動化流程可直接消費 list+health 結果，降低多命令 join 複雜度。
- 重用既有完整性掃描能力，避免重複實作。

負面與風險：

- `--health --json` 會產生新格式，需在文件中明確說明與舊模式差異。
- 掃描 directory 存在性可能增加 list 執行時間。

遷移與維護成本：

- 無資料遷移。
- 需持續維護 `rules list --health` 與 `doctor` 在狀態定義上的一致性。

## Rollout Plan

1. Phase 1（本輪 MVP）

- 新增 `rules list --health --concurrency`。
- 完成 JSON/文字輸出、測試與文件更新。

2. Phase 2（後續）

- 視使用情況評估是否加上 `--only-issues`（僅輸出 warn/fail）以提升大型規則集可讀性。

3. 回滾策略

- 如有相容問題可直接回滾本次 commit，`rules list` 退回既有行為。

## Test Plan

- E2E：
  - `rules list --health --json` 驗證輸出格式與狀態分類。
  - `rules list --health` 驗證文字模式摘要與狀態標記。
  - `--concurrency` 參數驗證（包含非法值）。
- 回歸：
  - 既有 `rules list --json` 測試保持通過，確認未開啟 `--health` 時輸出不變。
- 全量：`pnpm lint`、`pnpm test`、`pnpm build`。

## Observability

`rules list --health --json` 新增可觀測欄位：

- `summary.total/pass/warn/fail`
- `metrics.concurrency`
- `metrics.scanned`
- `metrics.uniqueProfilesChecked`
- `metrics.uniqueDirectoriesChecked`
- `metrics.scanDurationMs`

可用於追蹤規則健康比例與掃描成本趨勢。

## Security/Privacy

- 僅讀取本機 profile 與目錄狀態，不新增網路傳輸。
- 不輸出 token/secret，僅輸出規則目錄與 profile 名稱（既有資料面）。
- 不改變權限模型。

## Open Questions

- 後續是否要提供 `--only-issues` 以支援 CI 僅關注異常規則？
- `rules list --health --json` 是否需要提供固定 `version` 欄位，降低外部整合升級風險？
