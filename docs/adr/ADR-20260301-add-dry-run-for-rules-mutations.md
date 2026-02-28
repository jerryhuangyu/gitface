# ADR-20260301: 為 `gitface rules add/remove` 新增 `--dry-run` 安全預覽

## Context

`gitface rules add/remove` 會直接修改 global Git `includeIf.gitdir` 設定，屬於高影響操作；目前雖支援 `--json`，但缺乏「先預覽再落地」能力。這在腳本、自動化與批次維運情境造成兩個主要痛點：

1. 參數錯誤時會直接寫入 global config，回滾成本高。
2. 與 `use/import/remove/rename/clone` 已支援 `--dry-run` 的體驗不一致，增加使用心智負擔。

本輪 baseline（2026-03-01，本機）：

- `pnpm run lint`：pass（~0.25s）
- `pnpm run typecheck`：pass（~0.76s）
- `pnpm run test`：pass（17 files / 84 tests，~2.95s）
- `pnpm run build`：pass（`dist/index.js` 99.38 kB，gzip 20.93 kB，~0.21s）

## Decision

針對 `rules add` 與 `rules remove` 新增 `--dry-run`（MVP，向後相容）：

1. CLI 選項：
   - `gitface rules add <directory> <profile> --dry-run`
   - `gitface rules remove <directory> --dry-run`
2. 行為：
   - `rules add --dry-run`：驗證 profile 存在、正規化 directory、計算是否會覆蓋既有規則，但不寫入 Git config。
   - `rules remove --dry-run`：正規化 directory、檢查是否存在對應規則，但不刪除 Git config。
3. JSON 契約（`--dry-run --json`）：
   - `rules add`：`status`, `directory`, `profileName`, `overwrite`
   - `rules remove`：`status`, `directory`, `exists`
4. 非 JSON 輸出需明確標示「Dry run: no git config was changed.」。
5. 非 dry-run 路徑維持既有行為與 exit code 規則。

## Alternatives Considered

1. 維持現況（僅 `--json`）
- 優點：零開發成本。
- 缺點：高風險操作缺乏安全預演，CI 腳本難做先檢查後執行。

2. 只新增 `rules add --dry-run`，不處理 `rules remove`
- 優點：實作更小。
- 缺點：體驗不完整，仍有刪除誤操作風險。

3. 設計全域 `--plan` 覆蓋全部命令
- 優點：長期一致性高。
- 缺點：範圍過大，不符本輪最小可行交付。

## Consequences

正面：

- 高風險 global config 變更可先預覽，降低誤寫入風險。
- 自動化可先解析 JSON 預覽結果，再決定是否正式執行。
- `rules` 與其他命令的 `dry-run` UX 一致性提升。

負面與風險：

- 命令分支增加，需維持 dry-run 與實際路徑語意一致。
- 存在 TOCTOU：dry-run 與 real-run 間狀態可能改變。

遷移與維護：

- 無資料格式遷移；僅擴充 CLI 選項與輸出。
- 回滾可直接 revert 本次 commit。

## Rollout Plan

1. 先補 e2e 測試：驗證 add/remove dry-run 不寫入設定。
2. 新增 command option 與 action dry-run 分支。
3. 新增 dry-run human/JSON UI payload。
4. 更新 README / CLI / 使用手冊文件。
5. 執行 `lint/typecheck/test/build` 全綠後交付。

feature flag / 設定：

- 不新增 feature flag，由 `--dry-run` 顯式啟用。

回滾策略：

- 若發現回歸，revert 本次 commit 即可恢復舊行為。

## Test Plan

- E2E：
  - `rules add --dry-run --json` 回傳 `status: dry-run`，且不新增 global includeIf 規則。
  - `rules remove --dry-run --json` 回傳存在性（`exists`），且不刪除既有規則。
- 回歸：
  - 既有 `rules add/remove/list`（含 `--json`）行為保持不變。
- 品質閘道：
  - `pnpm run lint`
  - `pnpm run typecheck`
  - `pnpm run test`
  - `pnpm run build`

## Observability

目前以測試與 CLI 輸出作為觀測基礎：

1. 測試訊號：dry-run e2e 穩定通過且驗證 no-write。
2. 契約訊號：`--dry-run --json` 欄位穩定可解析。
3. 可靠性訊號：dry-run 後 `git config --global --list` 規則狀態不變。

後續可加入：

- rules mutations 的 dry-run vs real-run 次數；
- 覆蓋（overwrite）與不存在移除（exists=false）比例。

## Security/Privacy

- 不新增網路 I/O 與外部依賴。
- `--dry-run` 降低誤修改 global Git config 風險。
- 輸出資料僅包含目錄與 profile 名稱，不新增敏感憑證欄位。

## Open Questions

1. 是否應為 `rules add --dry-run` 加上 `currentProfileName`，提供更完整覆蓋 diff？
2. 是否要在未來提供 `rules sync --dry-run` 一次預覽多目錄調整？
