# ADR-20260301: 為 `gitface edit` 增加 `--dry-run` 預覽模式

## Context

GitFace 在最近幾輪已為 `new/use/remove/clone/rename/rules add/remove/import` 補上 `--dry-run`，但 `edit` 仍是唯一缺少預覽能力的 profile 變更命令。這讓自動化腳本在執行 `edit` 前無法安全確認最終輸出，使用者也難以在不落盤的情況下檢查 `--unset-signing-key` 等變更。

目前 baseline（2026-03-01，local）如下：

- `pnpm run lint`：通過，約 1s
- `pnpm run typecheck`：通過，約 0s
- `pnpm run test`：89 tests 全通過，約 4s
- `pnpm run build`：通過，約 1s
- 測試覆蓋率：Lines 77.61%、Branches 64.30%

痛點：

1. `edit` 直接寫入 profile，缺少「先看計畫再執行」流程，與其餘命令體驗不一致。
2. 自動化在 `--json` 模式下只能拿到「已更新」結果，無法先做 dry-run gate。
3. 更新邏輯目前由 `updateProfile` 一次完成讀取+更新+寫入，缺少可重用的「更新規劃」步驟。

## Decision

採用以下決策：

1. 為 `gitface edit` 新增 `--dry-run` 旗標。
2. 在 non-interactive 更新路徑中，`--dry-run` 只計算更新結果，不寫入 profile 檔與 identity include 檔。
3. 新增 `ProfileService.planUpdateProfile(name, update)`，回傳更新後的 Profile 供 dry-run 與正式更新共用，降低邏輯分岐。
4. `edit --dry-run --json` 輸出契約：
   `{ "status": "dry-run", "name": "work", "gitName": "...", "email": "...", "signingKey": null }`
5. 保持既有相容性：
   - `edit --json` 仍要求非互動更新旗標
   - 既有錯誤 JSON 格式與 exit code (`1`) 不變

## Alternatives Considered

1. 不新增 `--dry-run`，只更新文件說明 `edit` 直接寫入
   - 優點：零實作成本
   - 缺點：與其他命令體驗持續不一致，自動化風險高

2. 在 command 層直接組裝預覽結果，不新增 service 規劃方法
   - 優點：改動檔案較少
   - 缺點：更新邏輯會在 command/service 重複，長期維護成本較高

3. 只做 human output dry-run，不提供 JSON dry-run
   - 優點：CLI 體驗可改善
   - 缺點：無法滿足 CI/automation 可機讀驗收需求

## Consequences

正面：

- `edit` 與其他 mutation 命令達成一致的「先預覽再執行」體驗。
- automation 可先用 `--dry-run --json` 驗收，再決定是否執行正式更新。
- 透過 `planUpdateProfile` 共用更新規劃，降低重複邏輯。

負面/風險：

- 新增一個 service API，需維護其契約穩定性。
- 若未完善測試，可能出現 dry-run 與正式更新輸出不一致。

遷移與回滾：

- 屬加法變更，既有命令不受影響。
- 如需回滾，可移除 `--dry-run` option 與相關輸出函式，保留原 `updated` 路徑。

## Rollout Plan

1. Phase 1（本 PR）
   - 新增 `edit --dry-run`（human + json）
   - 新增 `planUpdateProfile` 並讓 `updateProfile` 共用
   - 補 e2e 測試
2. Phase 2（觀察）
   - 收集使用回饋與腳本採用情況（以 debug log 與 issue 為主）
3. 回滾策略
   - 若發現相容性問題，先回退 `edit` 命令 dry-run 分支，保留 service 重構可另行評估

## Test Plan

- 單元/整合：沿用既有 `ProfileService` 與 command 測試覆蓋
- E2E 新增：
  - `edit --dry-run --json` 不應改寫 profile
  - `edit --dry-run --json --unset-signing-key` 預覽應為 `signingKey: null`
- 回歸：`pnpm run lint && pnpm run typecheck && pnpm run test && pnpm run build`

## Observability

- `profile-service:updateProfile` 與 `planUpdateProfile` 沿用既有 logger（invoked/saved）脈絡。
- 關鍵指標（短期以測試與輸出契約驗證）：
  - dry-run 執行後 profile 檔案內容不變
  - dry-run JSON 結構穩定且可機讀

## Security/Privacy

- 不新增外部依賴與網路行為。
- dry-run 與正式模式都僅處理本地 profile 資料；不新增 token/PII 傳輸面。
- 維持既有最小權限：只有非 dry-run 正式路徑才寫入本地檔案。

## Open Questions

1. 未來是否要為 `edit --dry-run` 增加欄位級 diff（before/after）以提升可讀性？
2. 是否要在 telemetry（若未來導入）區分 dry-run 與 real-run 的採用率？
