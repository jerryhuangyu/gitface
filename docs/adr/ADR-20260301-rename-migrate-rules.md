# ADR-20260301: `gitface rename` 時自動遷移 folder rules 的 profile 參照

## Context

GitFace 目前支援：

- `gitface rules add <directory> <profile>` 透過 global git config 的 `includeIf.gitdir:<dir>.path=<profile-config-path>` 建立規則。
- `gitface rename <old> <new>` 會改名 profile 檔案（`<old>.gitconfig` -> `<new>.gitconfig`）並移除舊檔。

現況痛點：

- 若某 profile 已被多個 `rules` 參照，執行 `rename` 後，既有 `includeIf` 仍指向舊檔路徑，導致規則失效或在 `rules resolve --strict` 下回傳失敗。
- 使用者角度上，`rename` 會造成「改名後原本可用的目錄規則壞掉」，是高風險且不直覺的行為。

本輪 baseline（本地可量測）：

- `pnpm run lint`: pass（約 0.4s）
- `pnpm run typecheck`: pass（約 0.8s）
- `pnpm run test`: 17 files / 97 tests 全過（約 3.4s）
- `pnpm run build`: pass，`dist/index.js` 約 109 kB（gzip 約 22.32 kB）

## Decision

在 `gitface rename` 成功改名 profile 後，**自動遷移所有參照 `oldName` 的 folder rules 到 `newName`**，MVP 內容如下：

1. `rename` 完成 profile 寫入/移除後，掃描現有 rules。
2. 找出 `profileName === oldName` 的規則。
3. 逐條以既有規則 directory 重新寫入 `newName`（覆蓋同 key），確保 includeIf 指向新 profile config。
4. CLI 成功輸出新增可觀測欄位：
   - 人類可讀訊息包含遷移數量。
   - JSON 增加 `rulesUpdated`（整數）。
5. `--dry-run` 不寫入任何設定，但回報 `rulesToUpdate`，協助使用者預估影響面。

此決策保持預設安全與向後相容：

- 不改既有指令名稱與主要參數。
- 僅新增輸出欄位（非破壞性）。

## Alternatives Considered

1. 不自動處理，僅在文件提醒使用者手動重建 rules。
- 優點：實作成本最低。
- 缺點：高機率造成隱性壞掉；對自動化與新手體驗差。

2. `rename` 預設失敗，要求 `--migrate-rules` 才執行遷移。
- 優點：行為顯式。
- 缺點：增加操作摩擦，且預設仍可能讓多數使用者踩坑。

3. 在 `rules resolve` 時動態容錯並嘗試舊名映射。
- 優點：避免立即改動 global config。
- 缺點：複雜且治標不治本，持續留下壞設定與維運負擔。

## Consequences

正面：

- `rename` 變更後不會破壞既有目錄規則，可靠性提升。
- 降低使用者手動修復成本，避免 CI/agent 在 strict 模式下意外失敗。
- 透過 `rulesUpdated` / `rulesToUpdate` 提升可觀測性與可回放性。

負面 / 風險：

- `rename` 執行時間會隨被參照規則數量增加。
- 若使用者手動維護非標準 includeIf value（但 basename 恰為舊 profile），仍可能被遷移。

遷移與維護成本：

- 無資料格式遷移。
- 維護成本低，重用既有 RuleService API。

## Rollout Plan

1. Phase 1（本輪 MVP）
- 實作 rename 後自動遷移。
- 補 e2e 測試覆蓋：
  - rename 後 rules 仍可命中新 profile。
  - dry-run 回報 `rulesToUpdate` 且不改寫 global config。
- 更新 README / CLI / 使用手冊欄位說明。

2. Phase 2（後續可選）
- 針對大量 rules 增加更細緻的進度/耗時觀測。
- 評估是否為 `remove` 增加「被 rules 參照時阻擋或警告」策略。

回滾策略：

- 若發現回歸，可直接 revert 本 ADR 對應 commit，恢復舊行為。
- 因為只改動執行邏輯與輸出欄位，回滾不需資料還原腳本。

## Test Plan

- 單元/整合：
  - 服務層 rename + rule migration 的邏輯驗證（可由 e2e 先覆蓋）。
- E2E：
  - 建立 profile + rule，rename 後 `rules resolve` 應命中新名稱且 `profileExists=true`。
  - `rename --dry-run --json` 應回傳 `rulesToUpdate`，且 `rules list` 不變。
- 回歸：
  - 既有 rename 成功/錯誤/force/dry-run 測試維持通過。
- 品質門檻：
  - `pnpm run lint && pnpm run typecheck && pnpm run test && pnpm run build` 全綠。

## Observability

關鍵可觀測訊號：

- CLI JSON：
  - rename success: `rulesUpdated`
  - rename dry-run: `rulesToUpdate`
- 日誌：
  - 記錄 rename 觸發 rule migration 的數量與目錄（debug/info）。

建議追蹤指標（目前以測試與命令輸出代理）：

- rename 後 `rules resolve --strict` 的失敗率是否下降。
- rename 操作平均耗時與規則數量關聯。

## Security/Privacy

- 不新增外部網路或敏感資料蒐集。
- 僅操作本機 git config 與 profile 檔案。
- 維持最小權限與既有錯誤處理路徑。

## Open Questions

- 是否應在 `remove` 指令加入 `--strict`，當 profile 仍被 rules 參照時拒絕刪除？
- 是否要在 rename JSON 中加入受影響 directory 清單（目前先回傳 count，避免 payload 過大）？
