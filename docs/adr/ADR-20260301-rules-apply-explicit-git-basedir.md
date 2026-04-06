# ADR-20260301：`rules apply` 改用顯式 Git 目錄上下文，移除 `process.chdir`

## Context

`gitface rules apply [dir]` 目前在 `--scope local` 路徑會先 `process.chdir(targetDirectory)`，再呼叫 `ProfileService.applyProfile(...)`。這種做法雖可工作，但有幾個結構性問題：

1. `process.chdir` 是全域副作用，會影響同一個 Node process 內後續邏輯（包含錯誤處理、log 與外部包裝程式）。
2. 指令行為依賴隱式全域狀態，不利後續擴充（例如同 process 多任務執行、可回放執行器、或更細緻 observability）。
3. 可測試性較差：難以用小範圍單元測試驗證「目標 repo」與「目前工作目錄」被正確分離。

本輪 baseline（2026-03-01）：

- `pnpm run lint`：通過（Checked 70 files, 0 issues），總耗時約 `0.563s`。
- `pnpm run typecheck`：通過，總耗時約 `4.805s`。
- `pnpm run test`：通過（`18 files`, `121 tests`），總耗時約 `8.649s`。
- `pnpm run build`：通過，`dist/index.js 135.50 kB (gzip 26.69 kB)`，總耗時約 `5.020s`。

## Decision

在不改變 CLI 對外介面的前提下，將 `rules apply` 的 local scope 執行上下文改為顯式注入，而非切換 process cwd。

MVP 決策：

1. `ProfileService.create` 支援可選參數 `{ gitBaseDir?: string }`。
2. `ProfileService.create({ gitBaseDir })` 會建立 `new GitService({ baseDir: gitBaseDir })`。
3. `rules apply` 在 local scope 時，建立綁定 `targetDirectory` 的 `ProfileService` 實例執行 `getScopedIdentity/applyProfile`。
4. 移除 `rules apply` 內 `process.chdir` 及還原區塊。

此決策維持既有命令輸出格式、exit code 與旗標語意不變，僅改善實作可靠度與可維護性。

## Alternatives Considered

1. 保留現況（繼續使用 `process.chdir`）

- 優點：零改動、風險最低。
- 缺點：全域副作用持續存在，後續擴充與除錯成本高。

2. 在 `rules apply` 手動建立 `GitService`，跳過 `ProfileService.applyProfile`

- 優點：可完全避免 `ProfileService` 工廠改動。
- 缺點：命令層會重複業務邏輯，破壞 service 邊界，增加維護成本。

3. 大幅重構：全面導入 context object（cwd/config/log correlation）

- 優點：架構最乾淨，長期延展性最高。
- 缺點：本輪範圍過大，風險與驗證成本高，不符合小步快跑 MVP。

## Consequences

正面：

- 消除 `rules apply` 的全域 cwd 副作用，降低隱性錯誤風險。
- local scope 的目標目錄語意更明確（`gitBaseDir = targetDirectory`）。
- 對未來 observability / replay / 並行執行更友善。

負面與風險：

- `ProfileService.create` 介面新增可選參數，需注意既有呼叫點相容性。
- 若 local scope 注入目錄錯誤，可能導致套用到錯誤 repo（需測試覆蓋）。

遷移與維護成本：

- 無資料遷移。
- 需新增/維護一個 e2e 回歸案例以鎖定「cwd 不被改變」。

## Rollout Plan

1. Phase 1（本輪 MVP）

- 擴充 `ProfileService.create({ gitBaseDir? })`。
- 更新 `rules apply` local scope 走顯式 `gitBaseDir`。
- 新增 e2e：驗證 `rules apply <target-dir>` 執行後 `process.cwd()` 不變。
- 更新 README / CLI 文件補充行為說明。

2. Phase 2（後續）

- 盤點其他命令是否存在類似全域狀態依賴，逐步改成顯式 context。

3. 回滾策略

- 單一 revert 本 ADR 對應 commit，即可恢復原本 `chdir` 路徑。
- 對外 CLI 介面未變，回滾風險低。

## Test Plan

- E2E：
  - `rules apply <target-dir>` 可正確套用 local identity。
  - 執行前後 `process.cwd()` 一致（不被命令改變）。
- 回歸：
  - `pnpm run lint`
  - `pnpm run test`
  - `pnpm run build`

## Observability

- 延用現有 `logger`，以 `git-service` 的 `baseDir` 觀測操作目標。
- 關鍵指標：
  - `rules apply` 失敗率（不應上升）。
  - local scope 套用成功率（不應下降）。
  - 使用者回報「目錄被意外切換」問題數（目標為下降）。

## Security/Privacy

- 無新增外部 I/O 或權限需求。
- 僅改變本機 git 操作的目錄選擇方式，資料面不變。
- 不新增 token/PII 輸出。

## Open Questions

- 後續是否要把 `gitBaseDir` 概念上升為通用 `ExecutionContext`（包含 log correlation id）？
- 是否需要在 debug log 明確標記 `rules apply targetDirectory`，便於跨命令追蹤？
