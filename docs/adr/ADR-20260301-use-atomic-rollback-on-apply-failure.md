# ADR-20260301: `use` 指令套用 Git 身分時的原子性與失敗回滾

## Context

`gitface use <profile>` 目前會依序寫入三個 Git key：

1. `user.name`
2. `user.email`
3. `user.signingkey`（或 unset）

此流程屬於多步驟寫入，若中途任一操作失敗（例如 scope 權限、git config 寫入異常、外部環境問題），可能留下「部分已寫入、部分未寫入」的半完成狀態。這會造成：

- 使用者誤以為 profile 已完整切換，但實際上只套用部分欄位。
- 維運與除錯成本上升（需要人工比對三個 key 的一致性）。
- CI/自動化流程在非預期身分下繼續執行，增加錯誤提交風險。

本輪 baseline（2026-03-01）顯示品質門檻正常，但尚未驗證「寫入途中失敗」情境：

- `pnpm run typecheck`：通過（約 1s）
- `pnpm run lint`：通過（biome check）
- `pnpm run test`：19 files / 137 tests 全通過（約 14s）
- `pnpm run build`：通過（約 1s）

## Decision

在 `GitService.applyIdentity` 導入「回滾保護」：

1. 寫入前先讀取 target scope 目前 identity（`user.name`、`user.email`、`user.signingkey`）。
2. 嘗試執行既有寫入流程（set/unset）。
3. 若任一步驟失敗，立即用先前快照回復三個 key（set 回原值或 unset）。
4. 回滾成功時，拋出明確錯誤訊息，告知「套用失敗，已回滾」。
5. 回滾也失敗時，拋出聚合錯誤訊息，保留原始錯誤與回滾錯誤資訊，便於除錯。

此改動保持 CLI 介面與輸出格式向後相容，不新增旗標。

## Alternatives Considered

1. **不做回滾，只加強錯誤訊息**
- 優點：實作成本最低。
- 缺點：無法避免半完成狀態，核心風險仍存在。

2. **改成預先計畫所有變更後一次寫入（單一 git 命令）**
- 優點：理論上更接近真正原子。
- 缺點：Git config 並無直接一次更新多 key 的穩定介面；需大幅重構寫入機制與相容性處理。

3. **在 CLI 層做補償（`runUseAction` 內回滾）**
- 優點：較容易觀察命令級狀態。
- 缺點：回滾責任分散，不利重用；`GitService` 作為寫入邊界更適合承擔一致性保證。

## Consequences

### 正面

- `use` 寫入流程具備失敗補償，降低 Git 身分不一致風險。
- 發生錯誤時可提供更可操作的訊息，改善除錯體驗。
- 可靠性提升且不破壞既有 CLI 契約。

### 負面 / 成本

- 每次 `applyIdentity` 增加一次 scoped 讀取，帶來輕微額外 I/O。
- 錯誤處理分支變多，需補足測試以避免回歸。

### 風險

- 回滾流程本身也可能失敗（例如權限變化、系統錯誤）。
- 透過明確錯誤訊息與 logger 記錄降低定位成本。

## Rollout Plan

1. **MVP（本輪）**
- 在 `GitService.applyIdentity` 實作快照 + 失敗回滾。
- 新增單元測試覆蓋：成功、不需 signing key、寫入失敗後回滾、回滾失敗。
- 更新 `README` / `docs/cli.md` 行為說明。

2. **後續演進**
- 將回滾事件結構化輸出到 JSON log（便於收斂告警）。
- 視需求導入 command 級 metric（apply success/failure/rollback-failure 計數）。

3. **回滾策略（發布層）**
- 若出現非預期行為，可回退此 commit；CLI 介面未變，回退成本低。

## Test Plan

- 單元測試：
  - `applyIdentity` 成功寫入（含 signing key）。
  - `applyIdentity` 在 `signingKey=null` 時會 unset。
  - 中途失敗時會依快照執行回滾（set/unset 皆驗證）。
  - 回滾失敗時回傳含雙錯誤上下文的訊息。
- 回歸測試：執行全量 `pnpm run test`。
- 品質門檻：`pnpm run typecheck`、`pnpm run lint`、`pnpm run build`。

## Observability

- 既有 logger 補強：
  - `applyIdentity` 寫入失敗事件。
  - 回滾開始 / 成功 / 失敗事件。
- 關鍵指標（後續可接儀表板）：
  - `use_apply_failure_total`
  - `use_apply_rollback_success_total`
  - `use_apply_rollback_failure_total`

## Security / Privacy

- 不新增權限面與外部傳輸。
- log 僅記錄是否有 signing key，不輸出實際敏感值。
- 回滾策略有助於避免錯誤身份被持續使用，降低誤提交風險。

## Open Questions

- 是否要在 `--json` 模式中針對「已回滾失敗」提供更結構化錯誤碼（目前先維持字串錯誤訊息，相容既有輸出）。
