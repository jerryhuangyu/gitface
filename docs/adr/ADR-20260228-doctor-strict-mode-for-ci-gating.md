# ADR-20260228-doctor-strict-mode-for-ci-gating

## Context

GitFace 目前的 `doctor` 指令會輸出 `pass` / `warn` / `fail` 檢查結果，並且只在 `fail` 時回傳非零退出碼。這個設計對本機使用者友善，但在 CI 或自動化流程有一個痛點：`warn`（例如 global identity 缺失）常常代表環境尚未達到團隊規範，卻無法直接阻擋 pipeline。

本輪 baseline（2026-02-28）：

- `pnpm run lint`: pass，約 334ms。
- `pnpm run typecheck`: pass，約 1343ms。
- `pnpm run test`: pass，約 4007ms，70 tests 全過，整體 coverage statements 78.34%。
- `pnpm run build`: pass，約 1583ms，`dist/index.js` 92.75kB（gzip 19.87kB）。

目前 `doctor --json` 僅回傳 `hasFailures`，缺少 `hasWarnings`，使 CI 端若要自訂「警告即失敗」需解析整個 checks 陣列，增加整合成本。

## Decision

新增 `gitface doctor --strict` 模式，行為如下：

1. 保持既有預設模式不變（向後相容）：
   - 只有 `fail` 會令 exit code = 1。
2. 啟用 `--strict` 時：
   - 任何 `fail` 或 `warn` 皆令 exit code = 1。
3. 擴充 JSON 輸出：
   - 在 `doctor --json` 回傳中新增 `hasWarnings`（布林）。
4. 人類輸出摘要在 strict + warning 時顯示明確失敗訊息，降低誤判。

## Alternatives Considered

1. **直接把 `warn` 一律改為失敗（不加 flag）**
   - 優點：規則單純。
   - 缺點：破壞既有使用者預期，影響本機開發者流程，向後相容風險高。

2. **只在 JSON 模式支援嚴格判定（例如 `doctor --json --strict`）**
   - 優點：專注自動化場景。
   - 缺點：人類輸出模式在 CI 日誌排查時不一致，增加學習成本。

3. **新增獨立子命令（例如 `doctor-ci`）**
   - 優點：語意清楚。
   - 缺點：命令面擴張、不必要重複邏輯，維護成本高於旗標方案。

## Consequences

正面：

- CI 可直接以 exit code 驗收環境健康，不需額外腳本解析。
- JSON 輸出多 `hasWarnings` 後，機器判斷更穩定、整合更簡單。
- 預設行為不變，既有使用者不受影響。

負面/風險：

- `--strict` 可能讓部分舊 CI 在導入後立即失敗，需要流程調整。
- JSON schema 新增欄位雖為向後相容（additive），但少數嚴格 schema 驗證者需更新。

遷移與維護：

- 無需資料遷移。
- 文件需同步更新（README、CLI reference、使用者手冊）。

## Rollout Plan

1. 第 1 階段（本次）：
   - 實作 `--strict` 旗標與 exit code 規則。
   - JSON 新增 `hasWarnings`。
   - 補齊 e2e 測試與文件。
2. 第 2 階段（下輪可選）：
   - 在 CI 範本或 docs 補上建議使用 `doctor --strict --json`。

回滾策略：

- 若發現生態整合問題，可移除 `--strict` 對 warning 的致命判定（保留 flag 但暫時無效），或先回退至僅 `fail` 致命。
- JSON `hasWarnings` 可保留，不影響相容性。

## Test Plan

- 單元/整合（以 e2e 為主）：
  - 既有 `doctor`（無 strict）在 warning 場景維持 exit code = 0。
  - `doctor --strict` 在 warning 場景 exit code = 1。
  - `doctor --strict --json` 回傳 `hasWarnings: true` 且 exit code = 1。
  - `doctor --json` 在全 pass 場景回傳 `hasWarnings: false`。
- 回歸：
  - `pnpm run lint`
  - `pnpm run typecheck`
  - `pnpm run test`
  - `pnpm run build`

## Observability

- CLI 人類輸出：
  - strict 模式下，warning 觸發時輸出明確摘要訊息。
- 機器輸出：
  - `hasFailures` + `hasWarnings` 作為主要 gating 指標。
- 建議監測：
  - CI 上 `doctor --strict --json` 的失敗率（warn/fail 分類）。

## Security/Privacy

- 本變更不增加新權限需求。
- 僅影響健康檢查判定與輸出，不新增敏感資料收集。
- 維持最小揭露：訊息仍以既有 Git 設定可見資訊為主。

## Open Questions

- 是否要在未來加入 `--strict-level`（例如 `fail-only`/`warn-and-fail`）讓策略更細分？
- 是否需要在 release note 提供 CI 遷移範例（GitHub Actions / GitLab CI）？
