# ADR-20260301：為 import 新增 strict 模式以支援 CI 失敗閘門

## Context

2026-03-01 baseline（本輪實測）：

- `pnpm run lint`：通過，`real 0.28s`
- `pnpm run typecheck`：通過，`real 0.94s`
- `pnpm run test`：通過（`19 files / 131 tests`），`real 13.42s`，coverage `73.51%`
- `pnpm run build`：通過，`real 1.09s`，bundle `dist/index.mjs 140.26 kB (gzip 27.50 kB)`

目前 `gitface import` 採「逐筆處理、部分成功」策略：單筆失敗會被記錄在 summary，但整體命令通常仍以 exit code `0` 結束。  
對腳本與 CI 來說，這會產生「結果有 failed 但 pipeline 仍判定成功」的可靠性缺口，使用者必須額外解析輸出內容才能發現問題。

痛點：

1. 自動化流程無法只靠 exit code 判斷 import 是否完整成功。
2. 使用 `--dry-run` 預檢時，若有失敗項目也難以直接當作 gate。
3. 目前行為對互動式使用者友善，但對 CI 使用情境不夠嚴格。

## Decision

新增 `gitface import --strict`（MVP）：

1. 預設行為維持不變（向後相容）：沒有 `--strict` 時，保留「部分成功可完成」語意。
2. 指定 `--strict` 時，只要 summary `failed > 0`，命令即設定非零 exit code（`1`）。
3. `--strict` 同樣適用於 `--dry-run` 與 `--json`，讓預檢與機器可讀流程都可做一致 gating。
4. 保留既有 summary 結構與逐筆結果，降低現有整合風險。

## Alternatives Considered

1. 維持現況（不新增 strict）

- 優點：零改動成本。
- 缺點：CI/腳本仍需自行解析輸出，易漏判失敗。

2. 將 import 預設改為「任何失敗即整體失敗」

- 優點：語意最直接，安全性高。
- 缺點：破壞既有向後相容，影響目前依賴部分成功流程的使用者。

3. 新增獨立指令（例如 `import --validate-only` 或 `import check`）而非 strict

- 優點：功能邊界清楚。
- 缺點：命令面擴張、學習成本增加，且仍未直接解決實際 import 的 exit code gating 需求。

## Consequences

正面：

- 自動化可直接用 exit code 判斷 import 成敗，降低誤放行風險。
- `--dry-run --strict` 可作為部署前資料檢核 gate。
- 不改變預設行為，對既有使用者影響低。

負面：

- strict 模式下，部分成功的情境會回傳失敗，需使用者明確理解語意。
- 若既有腳本誤加 `--strict`，可能導致新的 pipeline fail（屬預期行為改變）。

風險與遷移：

- 無資料模型與存儲格式遷移。
- 風險主要在 CLI 行為分支，透過 e2e 測試覆蓋 strict/非 strict 可控。

## Rollout Plan

1. Phase 1（本輪 MVP）

- 新增 `import --strict` 參數與行為。
- 新增 e2e 測試（一般模式與 dry-run/json strict 模式）。
- 更新 README 與 CLI 參考文件。

2. Phase 2（後續）

- 視使用回饋，評估是否讓其他具 summary-failed 的命令也提供 `--strict` 一致語意。

3. 回滾策略

- 若行為不符預期，可直接 revert 本次 commit，恢復舊版 exit code 行為。

## Test Plan

- 單元/整合/E2E 回歸：
  - `pnpm run lint`
  - `pnpm run typecheck`
  - `pnpm run test`
  - `pnpm run build`
- 新增驗收測試：
  - `import --strict`：有失敗項目時 `process.exitCode === 1`
  - `import --dry-run --json --strict`：同樣在有失敗項目時為非零退出碼，且 JSON summary 仍可解析

## Observability

關鍵可觀測訊號：

1. `import` summary 的 `failed` 計數。
2. 在 strict 模式下，`failed > 0` 對應 exit code `1` 的一致性。
3. CI pipeline 的 import 階段 fail/pass 比例（導入 strict 後應更準確反映真實結果）。

## Security/Privacy

- 本決策不新增權限、不改變敏感資料存取路徑。
- 僅調整命令退出碼與控制流程，對隱私資料模型無新增風險。

## Open Questions

1. 是否要為 `export/import` 增加可選 telemetry hook（例如失敗數量統計）以便長期觀測？
2. 是否要在未來把 `--strict` 擴展為跨命令的一致 CLI 契約（doctor/prune/import 等）？
