# ADR-20260301: `rules apply` 支援 unmatched fallback profile

## Context

`gitface rules apply [directory]` 已可把「命中的 folder rule」直接套用到指定 scope，解決 `resolve + use` 兩步驟問題；但在以下場景仍有明顯摩擦：

- 新專案第一次納入 rules 流程時，常出現 `unmatched`，需改跑 `gitface use <name>` 才能繼續。
- CI/Agent 自動化若期待「盡量成功套用既定身份」，會因 `unmatched` 中斷（尤其搭配 `--strict`）。
- 使用者已知預設 profile（例如 `work`）時，仍缺少單一命令完成「先嘗試規則、失敗就降級套用」的路徑。

本輪 baseline（2026-03-01，本機）量測：

- `pnpm run lint`：通過（約 `1s`）
- `pnpm run typecheck`：通過（約 `1s`）
- `pnpm run test`：通過（`17 files / 107 tests`，約 `3s`）
- `pnpm run build`：通過（約 `2s`）
- Coverage：Statements `74.92%`、Branches `61.25%`、Functions `82.89%`、Lines `75.07%`
- Bundle：`dist/index.js 123.33 kB (gzip 24.83 kB)`

## Decision

在 `gitface rules apply [directory]` 新增選項：

- `--fallback-profile <name>`

行為定義：

1. 先照原本流程嘗試 rules resolve。
2. 若有命中規則，維持既有行為（`applied` / `unchanged` / `dry-run`）。
3. 若無命中且有提供 `--fallback-profile`：
   - 改套用 fallback profile。
   - JSON 輸出新增 `resolution: "fallback"`、`matchedRule: null`、`fallbackProfileName`，保持可機器判讀。
4. 若無命中且未提供 fallback，維持既有 `unmatched` 語意；`--strict` 仍回傳 exit code `1`。

## Alternatives Considered

1. 維持現況（只回傳 `unmatched`，由使用者自行改跑 `use`）

- 優點：零開發成本。
- 缺點：自動化流程斷點多，首次導入 rules 體驗差。

2. 新增 `rules apply --remember-fallback`，同時寫入 rule

- 優點：一次完成套用與規則落地。
- 缺點：語意更複雜、風險較高（會隱式寫 global includeIf）；本輪先不做，避免範圍膨脹。

3. 在 `use` 命令加上 `--from-rules --fallback`

- 優點：集中在單一套用命令。
- 缺點：`use` 職責過重，rules 領域邏輯外溢，不利維護。

## Consequences

正面：

- 降低 `rules apply` 的中斷率，改善 CI/Agent 與新目錄首次使用體驗。
- 仍保留 strict gate 能力；只有明確指定 fallback 才啟用降級路徑。
- JSON 契約可觀測，便於後續統計 fallback 使用比例。

負面：

- `rules apply` 輸出分支增加（rule vs fallback），測試與文件維護成本上升。
- 若使用者錯設 fallback profile，可能套用到非預期身份（但可用 `--dry-run` 與 `current` 驗證）。

遷移/回滾：

- 無資料遷移。
- 回滾可直接移除 `--fallback-profile` 選項及其輸出分支，revert commit 即可。

## Rollout Plan

1. 擴充 CLI：`rules apply` 加入 `--fallback-profile`。
2. 實作 apply 流程的 fallback 分支（含 `dry-run` / `unchanged` / `applied` JSON 與 human output）。
3. 先補 e2e：
   - unmatched + fallback 可成功套用
   - fallback profile 不存在時回傳錯誤
4. 更新 README、`docs/cli.md`、`docs/user-manual.zh-TW.md`。
5. 執行 `lint`、`typecheck`、`test`、`build`。

## Test Plan

- 單元/整合：沿用現有 `rules apply` 與 profile 讀取路徑，確保型別與 scope 驗證不回歸。
- E2E（新增）：
  - `rules apply --strict --fallback-profile <name> --json` 在 unmatched 場景下仍可套用成功，且 Git local config 寫入正確值。
  - `rules apply --fallback-profile <missing> --json` 回傳 `status: "error"` 與 exit code `1`。
- 回歸：`rules apply` 原本 matched / dry-run / strict unmatched 測試持續綠燈。

## Observability

建議追蹤（以 CLI JSON 與 CI 日誌收集）：

- `rules apply --json` 的 `status` 分布（`applied/unchanged/dry-run/unmatched/error`）。
- `resolution` 分布（`rule` vs `fallback`；目前 fallback 分支會輸出 `resolution: "fallback"`）。
- strict pipeline 失敗率（觀察 fallback 是否降低 unmatched fail）。

## Security/Privacy

- 不新增外部網路請求。
- 只在既有 Git scope 寫入 `user.*`，預設仍是 `local`（最小影響面）。
- 不新增敏感資料儲存；JSON 僅輸出既有 profile 欄位與決策狀態。

## Open Questions

- 後續是否要提供 `--remember-fallback`，在 fallback 成功後可選擇自動寫入 rule？
- 是否要在非 JSON human output 也顯式標示 `resolution: rule|fallback` 以利 log parsing？
