# ADR-20260301: 擴充 rules add 的 profile shell 自動補全

## 背景（Context）

GitFace 目前已提供 shell snippet 生成功能（`gitface completion snippet --shell bash|zsh`），並支援多數 profile 參數補全（`use`、`rm/remove`、`edit`、`clone`、`rename/mv` 的來源參數）。  
但 `gitface rules add <directory> <profile>` 的 `<profile>` 仍缺少補全，造成以下痛點：

- 使用者在設定資料夾規則時，需要手動輸入 profile 名稱，容易 typo。
- `rules add` 是高頻路徑之一（規則化切換身份），但互動體驗落後其他命令。
- 一旦輸入錯誤，會進入「失敗 -> 重打」循環，增加操作成本。

本輪 baseline（2026-03-01，本機）：

- `pnpm -s lint`：pass（`real 0.38s`）
- `pnpm -s typecheck`：pass（`real 0.79s`）
- `pnpm -s test`：pass（`17 files / 77 tests`，`real 3.32s`）
- `pnpm -s build`：pass（`dist/index.js 94.75 kB`，gzip `20.17 kB`，`real 0.97s`）

## 決策（Decision）

採用「小步、相容、可驗收」策略，新增 `rules add` profile 參數補全：

1. 更新 bash/zsh snippet 規則，當命令為 `gitface rules add` 且游標位於 profile 參數位置時，呼叫 `gitface completion profiles --prefix ...` 提供補全候選。
2. 維持既有命令補全行為不變（`use`、`rm/remove`、`edit`、`clone`、`rename/mv`）。
3. 補上 e2e 測試，驗證 snippet 內含新的 `rules add` 位置守衛。
4. 更新 README 與 CLI 文件，讓使用者知道 `rules add` 也支援 profile 補全。

## 替代方案評估（Alternatives Considered）

1. 不做變更，維持現況。  
優點：零成本。  
缺點：`rules add` 體驗持續不一致、錯字成本持續存在。

2. 新增完整 `rules` 子命令多層補全（含 directory 候選）。  
優點：體驗最佳。  
缺點：需要更多 shell 相依邏輯與路徑來源策略，超出本輪 MVP。

3. 在 `rules add` 失敗時僅提供更強錯誤提示，不做補全。  
優點：改動較小。  
缺點：仍是事後修復，無法降低輸入前錯誤率。

## 影響與取捨（Consequences）

正面影響：

- `rules add` 與其他 profile 型命令體驗一致。
- 減少 profile 名稱輸入錯誤與重試次數。
- 以低風險改動提升日常操作效率。

負面影響與風險：

- snippet 位置判斷邏輯變長，維護成本略增。
- shell 變體/插件若改寫 completion 行為，可能影響位置判斷。

遷移與維護成本：

- 使用者需重新產生並套用 snippet 才能取得新能力。
- 無資料遷移需求。

## 推出計畫（Rollout Plan）

1. 新增/更新 completion e2e 測試（先測試）。
2. 調整 bash/zsh snippet 位置守衛與命令條件。
3. 更新 README 與 `docs/cli.md` 文件說明。
4. 跑 `lint/typecheck/test/build` 確認品質門檻。
5. 發佈後若收到 shell 相容回報，可直接回滾 snippet 變更（不影響資料層）。

Feature flag / 設定：

- 不需要。此改動為 additive 且向後相容。

回滾策略：

- 單純 revert 本次 completion snippet 與文件變更即可。

## 測試計畫（Test Plan）

- 單元/整合：
  - 以既有 completion e2e 驗證 snippet 內容含 `rules add` 的位置守衛。
- 回歸：
  - 確認既有命令補全條件字串仍在（`use`、`rm/remove`、`edit`、`clone`、`rename/mv`）。
- 品質 gate：
  - `pnpm -s lint`
  - `pnpm -s typecheck`
  - `pnpm -s test`
  - `pnpm -s build`

效能：

- 不新增 runtime command；僅補全條件判斷分支，理論上對啟動效能影響可忽略。

## 可觀測性（Observability）

目前專案無集中式 telemetry，採可觀測替代指標：

- completion e2e 是否穩定通過。
- 使用者在 `rules add` 的 profile typo/失敗回報是否下降（issue/回饋）。
- CLI 失敗訊息中 `rules add` profile 不存在的出現頻率（人工觀察）。

## 安全與隱私（Security/Privacy）

- 僅讀取本機 profile 名稱，不新增網路傳輸。
- 不新增 token/PII 蒐集路徑。
- 符合最小權限原則（沿用既有 completion 行為）。

## 未決問題（Open Questions）

- 是否要在下一輪加入 `rules add` 第一個參數（directory）的路徑補全？
- 是否擴充到 fish shell，建立統一 completion 測試矩陣？
