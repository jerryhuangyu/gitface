# ADR-20260301: 新增 `gitface rules resolve` 以解析目錄的有效身份規則

## Context

GitFace 目前已支援 `rules add/remove/list`，可以管理 `includeIf.gitdir` 規則；但缺少「針對某個目錄，實際會命中哪條規則」的查詢能力。當使用者同時配置了多層路徑（例如 `/work/` 與 `/work/monorepo/`）時，常見痛點是：

- 難以快速判斷最終生效規則，導致 commit 身份與預期不一致。
- 排障流程需要手動比對 `git config --global --list` 與多條 includeIf，成本高且容易出錯。
- 自動化（CI/Agent）無法直接取得可機器解析的「規則命中結果」。

本輪 baseline（2026-03-01，本機）量測：

- `pnpm run lint`：通過，`real 0.38s`
- `pnpm run typecheck`：通過，`real 0.81s`
- `pnpm run test`：通過，`17 files / 93 tests`，`real 3.36s`
- `pnpm run build`：通過，`real 0.98s`，`dist/index.js 105.33 kB (gzip 21.68 kB)`
- 覆蓋率：Statements `77.38%`、Branches `64.61%`、Functions `85.76%`、Lines `77.65%`

補充：本地環境無法離線存取遠端 issue/PR 與 GitHub Actions 即時狀態，本輪以 repo 內 workflow 定義、最近 commits 與本機 quality gates 作為決策依據。

## Decision

新增 `gitface rules resolve [directory]`（預設 `directory = cwd`），提供人類可讀與 JSON 兩種輸出，並採「最長目錄前綴優先」決定命中規則。

1. CLI 行為

- 新增子命令：`gitface rules resolve [directory]`
- 支援 `--json`
- 若省略 `directory`，使用當前工作目錄

2. 規則解析邏輯

- 先將輸入目錄正規化為絕對路徑且以 `/` 結尾（沿用既有 `Rule.create`）
- 從 global config 讀取所有 rules
- 篩選出「rule.directory 為目標目錄前綴」的候選
- 挑選目錄字串最長者作為最終命中規則（即更具體路徑優先）

3. 輸出契約

- 命中時：回傳 `matchedRule`（`directory`、`profileName`）與 `profileExists`（對應 profile 是否存在）
- 未命中時：回傳 `status: "unmatched"` 與 `matchedRule: null`
- 保持未命中為成功狀態（exit code `0`），避免把查詢結果誤判為流程失敗

## Alternatives Considered

1. 不新增命令，僅靠 `rules list` + 手動比對

- 優點：零開發成本
- 缺點：排障成本高、容易誤判、無法機器化驗證命中規則

2. 在 `gitface current` 內增加 rules 命中資訊

- 優點：一次命令可看到當前身份與來源
- 缺點：責任混雜（identity 與規則解析耦合），會擴大 `current` 輸出契約風險

3. 直接呼叫 `git config` 並輸出原始 includeIf key/value

- 優點：實作最小
- 缺點：仍需消費端自行實作「最長前綴規則」判斷，UX 與自動化價值不足

## Consequences

正面：

- 可快速定位「某目錄會吃到哪條規則」，降低錯誤身份提交機率。
- 讓 agent/CI 能直接依 JSON 驗證規則命中，提升可觀測與可回放性。
- 補齊 rules 生態（add/remove/list/resolve），提升資訊閉環。

負面與風險：

- 增加一個 CLI 子命令與輸出契約，需要持續維護文件與測試。
- 規則解析採字串前綴比對；若未來需支援更複雜 gitdir pattern，需擴充演算法。

遷移與維護成本：

- 低。新功能為增量，不影響既有命令。
- 回滾簡單，可直接 revert 本次 commit。

## Rollout Plan

1. 新增 `RuleService.resolveRuleForDirectory`（最長前綴解析）。
2. 新增 `rules resolve` 子命令與 human/JSON 輸出。
3. 補 e2e 測試：命中最具體規則、無命中輸出。
4. 更新文件（README、CLI reference、中文手冊）。
5. 執行完整 quality gates（lint/typecheck/test/build）。
6. 若回歸：移除 `resolve` 子命令並 revert 相關 service 與文件。

## Test Plan

- e2e：
  - 有重疊規則時，`rules resolve --json` 必須命中最長路徑規則。
  - 無規則命中時，`rules resolve --json` 回傳 `status: "unmatched"`。
- 回歸：既有 `rules add/remove/list` 測試需全數通過。
- 品質閘道：
  - `pnpm run lint`
  - `pnpm run typecheck`
  - `pnpm run test`
  - `pnpm run build`

## Observability

關鍵觀測指標：

- `rules resolve --json` 在命中/未命中場景皆可穩定解析。
- 規則重疊時的命中決策可由 `matchedRule.directory` 直接觀測。
- `profileExists` 可顯示規則是否指向不存在 profile（配置漂移訊號）。

目前無集中 telemetry，本輪以 e2e 測試與 JSON 契約穩定性作為主要可觀測手段。

## Security/Privacy

- 輸出僅包含路徑與 profile 名稱，不包含 email/signing key 等敏感資訊。
- 不新增網路呼叫與額外權限需求。
- 仍遵守既有最小權限：僅讀取 Git global config 與本地 profile store。

## Open Questions

- 是否要為 `rules resolve` 增加 `--strict`，在命中但 `profileExists=false` 時回傳 exit code `1`（方便 CI gate）？
- 是否需要支援「顯示候選規則清單」模式（不只回傳最終命中）以強化除錯能力？
