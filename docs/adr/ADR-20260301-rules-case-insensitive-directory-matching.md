# ADR-20260301：rules resolve/apply 在大小寫不敏感平台採用大小寫不敏感目錄匹配

## Context

GitFace 的 `rules resolve` 與 `rules apply` 目前以字串前綴做目錄匹配（`startsWith`），比對邏輯是大小寫敏感。

在 macOS（預設 APFS）與 Windows（NTFS 常見設定）這類大小寫不敏感檔案系統上，使用者可能透過不同大小寫路徑進入同一資料夾（例如規則儲存為 `/Users/Jerry/work/`，實際命令在 `/users/jerry/work/repo` 執行）。作業系統層面這是同一路徑，但 GitFace 現況會回報 `unmatched`，造成：

- 使用者誤判規則失效，核心流程（自動套用身份）中斷。
- `rules apply --strict` 在 CI/自動化流程中產生誤報失敗。
- 體驗上出現「明明有規則但不生效」的困惑。

本輪 baseline（2026-03-01）顯示功能穩定（`124` tests 全綠），但這類跨平台路徑語意差異尚未被明確處理。

## Decision

在 `RuleService.resolveRuleForDirectory` 的目錄匹配階段導入平台感知正規化：

- macOS / Windows：以大小寫不敏感方式比對（統一轉小寫後匹配）。
- Linux 與其他平台：維持大小寫敏感比對。
- 規則儲存格式不變（不做資料遷移），僅調整「解析時」比對邏輯。
- 以純函式抽出匹配規則，提供單元測試覆蓋平台差異與「最長前綴優先」行為。

此決策屬可靠性 + UX 改進，對外行為是「讓大小寫不敏感平台更符合使用者直覺」。

## Alternatives Considered

1. 全平台一律大小寫不敏感比對
- 優點：實作最簡單。
- 缺點：會破壞 Linux 上合法且有意義的大小寫區分目錄，導致錯配風險。

2. 寫入規則時一律 `realpath` 並強制 canonical case
- 優點：可在資料層盡早正規化。
- 缺點：對不存在目錄/未掛載路徑不友善，且可能引入 symlink 語意變更；遷移與回溯成本較高。

3. 維持現況，只在文件補註
- 優點：零程式風險。
- 缺點：無法解決真實失配問題，持續造成使用者摩擦與 strict 模式誤報。

## Consequences

### 正面

- macOS/Windows 使用者在不同大小寫路徑下仍可穩定命中規則。
- `rules resolve/apply` 行為更貼近檔案系統語意，降低誤判 unmatched。
- 不需遷移既有規則資料，回滾簡單。

### 負面/風險

- 平台行為差異更明確（Linux 仍大小寫敏感），需文件說明。
- 若使用者在大小寫不敏感平台刻意建立僅大小寫不同規則，最長前綴/排序可能出現不可預期競合；屬邊界案例。

### 維護成本

- 新增少量匹配輔助函式與測試；長期維護成本低。

## Rollout Plan

1. MVP（本輪）
- 在 `RuleService` 新增平台感知匹配函式。
- 調整 `resolveRuleForDirectory` 使用該函式。
- 補單元測試（平台差異 + 最長前綴）。
- 更新 README / CLI 文件。

2. 保護機制
- 本變更不需要 feature flag（低風險、僅解析邏輯）。
- 可用既有測試與新增測試驗證。

3. 回滾策略
- 若發現非預期匹配，回滾單一 commit 即可恢復舊行為。

## Test Plan

- 單元測試：
  - 大小寫不敏感平台（darwin/win32）應匹配不同大小寫路徑。
  - 大小寫敏感平台（linux）不應匹配不同大小寫路徑。
  - 多規則命中時仍採「最長前綴優先」。
- 回歸測試：跑全量 `pnpm run test`。
- 品質檢查：`pnpm run lint`、`pnpm run build`。

## Observability

- 本輪不新增 telemetry；使用既有 CLI 輸出可觀察：
  - `rules resolve --json` 的 `status`（`matched`/`unmatched`）
  - `rules apply --json` 的 `status`
- 關鍵指標（人工追蹤）：
  - 大小寫差異路徑場景下 `unmatched` 比例下降。
  - strict 模式下因路徑大小寫造成的失敗次數下降。

## Security/Privacy

- 不引入新權限、不新增外部 I/O、無額外個資處理。
- 僅調整記憶體內字串比對，安全風險低。

## Open Questions

- 未來是否要引入「symlink/canonical path」模式（可選）以進一步減少路徑語意差異？
- 是否需要在 `rules doctor` 額外提示可能的大小寫競合規則？
