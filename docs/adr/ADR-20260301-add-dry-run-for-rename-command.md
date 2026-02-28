# ADR-20260301: 為 rename 指令新增 dry-run 預覽模式

## Context

`gitface rename <old> <new>` 目前會直接寫入新 profile 並刪除舊 profile。  
在批次腳本、CI、或多人共用設定時，改名屬於高風險操作，若目標名稱衝突或參數誤填，容易造成額外修復成本。

現況痛點：

1. 與 `use`、`import`、`remove` 相比，`rename` 缺少「先看影響再執行」的安全機制，操作體驗不一致。
2. 自動化流程無法在不變更檔案的前提下驗證「來源是否存在、目標是否會覆蓋」。
3. `rename` 測試覆蓋雖有成功/失敗路徑，但缺少預覽語意，無法驗證安全欄位輸出。

本輪 baseline（2026-03-01，本機）：

- `pnpm -s run lint`：pass，`real 0.44s`
- `pnpm -s run typecheck`：pass，`real 1.57s`
- `pnpm -s run test`：pass，`17 files / 80 tests`，`real 3.89s`
- `pnpm -s run build`：pass，`dist/index.js 96.09 kB`（gzip `20.45 kB`），`real 1.81s`

## Decision

為 `gitface rename` 新增 `--dry-run`，提供「可驗證、不落地」的 MVP：

1. CLI 新增 `rename --dry-run` 選項，介面維持向後相容。
2. `--dry-run` 路徑會檢查：
   - 來源 profile 是否存在；
   - 目標 profile 是否存在（搭配 `--force` 決定是否允許覆蓋）。
3. `--dry-run --json` 輸出機器可讀預覽：
   - `status`, `oldName`, `newName`, `overwrite`, `gitName`, `email`, `signingKey`。
4. 非 JSON 模式提供明確「不會寫檔」提示與覆蓋資訊。
5. 保持既有成功/錯誤碼規則，失敗仍回傳 exit code `1`。

## Alternatives Considered

1. 維持現況，不做 dry-run
- 優點：零改動。
- 缺點：高風險操作缺乏預演能力，與其他命令 UX 不一致。

2. 只在文件提供「先 clone 再 remove」替代流程
- 優點：不改程式碼。
- 缺點：流程冗長且可出錯點更多，無法提供單指令驗證。

3. 新增全域 `--plan` 統一所有命令
- 優點：長期一致性高。
- 缺點：範圍過大，需跨多命令設計與回歸，不適合本輪 MVP。

## Consequences

正面：

- 使用者可先驗證 rename 影響，降低誤操作風險。
- 自動化腳本可先檢查衝突與覆蓋語意，再決定是否實際執行。
- 命令體驗與 `use/remove/import` 更一致，學習成本下降。

負面與風險：

- command 行為分支增加，需額外維護 dry-run 輸出契約。
- `overwrite` 為預估值，真正執行時若檔案狀態在兩次操作間改變，結果可能不同（TOCTOU）。

遷移與維護成本：

- 無資料遷移。
- 回滾可直接 revert 本次變更，不影響既有 profile 檔案格式。

## Rollout Plan

1. 新增 rename dry-run e2e 測試（一般情境與 `--force` 覆蓋情境）。
2. 新增 command flag、action 分支與 UI/JSON 輸出。
3. 更新 CLI 與 README 文件。
4. 執行 `lint/typecheck/test/build`。

feature flag / 設定：

- 本輪不引入新 feature flag；透過顯式 `--dry-run` 啟用。

回滾策略：

- 若觀察到回歸，直接 revert 該 commit，恢復原本 rename 行為。

## Test Plan

- E2E：
  - `rename --dry-run --json` 不應改動檔案，並回傳預覽 JSON。
  - `rename --dry-run --force --json` 在目標存在時應回傳 `overwrite: true` 且不改動檔案。
- 回歸檢查：
  - `pnpm -s run lint`
  - `pnpm -s run typecheck`
  - `pnpm -s run test`
  - `pnpm -s run build`

## Observability

目前無集中 telemetry，本輪觀測指標：

1. 測試訊號：rename e2e 對 dry-run 成功率。
2. 體驗訊號：`--dry-run --json` 輸出是否穩定（欄位完整且可供腳本解析）。
3. 失敗訊號：衝突/不存在時 exit code 與錯誤訊息是否保持一致。

後續若導入 metrics，可新增：

- `rename` 命令執行次數（dry-run vs real-run）；
- rename 失敗率與衝突率。

## Security/Privacy

- 不新增外部網路存取；僅讀寫本機 profile 檔。
- `--dry-run` 不落地寫入，可降低誤刪/誤覆蓋風險。
- 輸出內容延續既有 profile 欄位，不新增敏感資料收集。

## Open Questions

1. 是否要讓 `rename --dry-run` 在非 JSON 模式也輸出更結構化 diff（便於人工稽核）？
2. 是否要擴充 `rename` 支援 `--json` 的 `skipped` 狀態（例如 old/new 同名）以強化腳本語意？
