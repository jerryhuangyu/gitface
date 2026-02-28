# ADR-20260301: 為 `gitface completion profiles` 增加 `--json` 結構化輸出

## Context

GitFace 幾乎所有高頻命令都已支援 `--json`（例如 `new/edit/list/use/current/doctor/clone/rename/remove/export/import/rules`），但 `gitface completion profiles` 目前僅提供以分隔符串接的純文字輸出。這造成兩個痛點：

- 自動化流程（特別是 AI agent 或 CI 腳本）難以直接取得補全結果的「輸入條件與結果統計」，例如 prefix、limit、命中數。
- 當補全沒有命中時，純文字模式會輸出空內容；流程端難以區分「真的無命中」與「命令未執行/輸出被吞掉」。

本輪 baseline（2026-03-01，本機）量測：

- `pnpm run lint`：通過，`real 0.40s`
- `pnpm run typecheck`：通過，`real 0.97s`
- `pnpm run test`：通過，`17 files / 91 tests`，`real 3.56s`
- `pnpm run build`：通過，`real 1.37s`，`dist/index.js 104.97 kB (gzip 21.61 kB)`

另外，repo 內未包含可離線讀取的 issue/PR 與遠端 CI API 資料，本輪以本機 git history、workflow 定義與本地 quality gates 作為決策依據。

## Decision

在不破壞既有 shell 補全行為下，為 `gitface completion profiles` 新增可選 `--json`：

1. 新增旗標：`gitface completion profiles --json`。
2. JSON 回傳固定結構：
   - `{ "topic": "profiles", "prefix": string | null, "limit": number | null, "count": number, "names": string[] }`
3. `--json` 模式下：
   - 無論是否命中都輸出有效 JSON（包含 `count` 與 `names`）。
   - 保留既有 `--prefix`（不分大小寫）與 `--limit`（正整數）語義。
4. 非 JSON 模式維持原行為（向後相容）：
   - 輸出以 delimiter 串接的名稱。
   - 無命中時不輸出任何內容。

## Alternatives Considered

1. 維持現況（不加 `--json`）

- 優點：零改動、零相容風險。
- 缺點：自動化可觀測性持續不足，與其他命令介面不一致。

2. 另開新子命令（例如 `completion profiles-json`）

- 優點：避免單命令多輸出模式。
- 缺點：CLI surface 擴張、學習成本增加，且與既有 `--json` 慣例不一致。

3. 僅在純文字模式加入「no match」提示字串

- 優點：實作最小。
- 缺點：仍難機器解析，且可能破壞現有 shell completion 預期輸入格式。

## Consequences

正面：

- 補全命令可被自動化可靠解析，提升 AI agent/CI 的可觀測性與可回放性。
- 命令介面與專案既有 `--json` 慣例一致，降低使用認知成本。
- 空結果情境可被明確辨識（`count: 0`, `names: []`）。

負面與風險：

- 增加一組輸出契約，需維護文件與測試避免後續破壞。
- 若使用者在 `--json` 模式仍搭配 `--delimiter`，旗標語意會變得不直覺（但不影響既有 shell 流程）。

遷移與維護成本：

- 低。`--json` 為可選旗標，不影響既有呼叫。
- 回滾簡單，可直接 revert 本次 commit。

## Rollout Plan

1. 先新增 completion e2e 測試（JSON 命中 / JSON 空結果）。
2. 實作 `completion profiles --json` 輸出邏輯。
3. 更新 CLI 參數定義與文件（README、CLI reference、中文手冊）。
4. 跑完整 quality gates（lint/typecheck/test/build）。
5. 若回歸：
   - 快速回滾策略：移除 `--json` 旗標與輸出分支（保留既有純文字路徑）。

## Test Plan

- 單元/整合：沿用現有 completion e2e 測試架構。
- 新增驗收案例：
  - `completion profiles --prefix <value> --limit <n> --json` 輸出正確 JSON 結構與命中結果。
  - `completion profiles --prefix <value> --json` 在無命中時輸出 `count: 0` 與空陣列。
- 回歸驗證：
  - 既有 prefix 比對、limit 驗證、snippet 輸出測試需全數通過。
- 品質閘道：
  - `pnpm run lint`
  - `pnpm run typecheck`
  - `pnpm run test`
  - `pnpm run build`

## Observability

關鍵指標：

- 補全命令在 JSON 模式下的可解析成功率（CI/e2e pass rate）。
- JSON `count` 與 `names.length` 一致性（透過測試保證）。
- 補全空結果可被流程顯式識別（不再依賴空 stdout 推斷）。

目前無集中 telemetry，本輪以測試覆蓋與本地命令輸出一致性作為觀測手段。

## Security/Privacy

- 新增 JSON 僅回傳 profile 名稱與查詢參數，不含 email/signingKey 等敏感欄位。
- 不新增外部 I/O、網路呼叫或權限變更。

## Open Questions

- 未來是否要在 `completion profiles --json` 增加 `truncated: boolean`，讓流程可直接判斷是否被 `--limit` 截斷？
- 是否要讓 `completion snippet` 提供可選模板，直接輸出 JSON 以供進階 shell/agent 整合？
