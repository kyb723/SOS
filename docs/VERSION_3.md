# SOS Version 3 — calendar, weekly rota and SH

## 使用方式

Availability 一開就有星期一至星期日月曆，點日期選取，再點取消。可跨月份選非連續日子；日期會累積並顯示總數。綠色係已選，今日有綠框，其他月份日期較暗，全部日期按鈕可用 Tab／Enter／Space，亦可用方向鍵喺目前月曆範圍移動。

揀完日期後，一次填同一組時間、All day 同分店偏好，再睇 Review before saving。冇日期、分店、時間錯誤或已有同員工日期提交時，Submit 會停用。已有紀錄會顯示 **Update existing**，按後係打開原有整筆提交作編輯，唔會偷偷 overwrite 或合併。其他月份嘅紀錄同 inbox 歷史繼續保留。舊版如已有同日多筆資料唔會自動刪除；編輯時可以先取消重複日子，或由 inbox 明確移除唔需要嘅紀錄。

手機（≤760px）改用七日 grid，員工喺左邊，毋須橫向捲動。今個月預設顯示今個星期，其他月份由首日所在星期開始，可按 Previous／Next week。七日可以跨月；員工旁工時一直指上方選定月份，而非七日合計。Desktop 保留月曆。

手機 `SW` 代表 SOHO W，`D` 代表 Draft，`Av` 代表 Availability；點任何日格睇全名、完整時間、分店、狀態同 availability。Manager 可以由 details 進入編輯。

## SH

Manager 按 **+ SH item**，揀 full-time 員工、日期、分店、SH01–SH12 同 Draft／Published。點 SH 格可以編輯，或者刪除；Publish N drafts 會同時發佈目前月份／分店內嘅工作更同 SH。Staff 只見 published。

SH 以 teal 顯示，係獨立 `shItems`，冇 start/end，唔會進入 working hours 或 availability Scheduled 計算。視作全日：同員工同日唔可有第二個 SH 或工作班次，包括其他分店同 drafts。呢個係 prototype 錄入規則，唔係法律規定。

`src/lib/rota-config.ts` 嘅 `SH_CODES` 可擴展；`FULL_TIME_EMPLOYEE_IDS` 目前為虛構 Alex、Jamie、Sam，日後可以改接員工資料。只擴充 codes，唔好刪除已用代碼，以免舊紀錄驗證失敗。冇計 entitlement、holiday pay、法定假期日曆或法律合規。

## 資料相容

Storage key 仍為 `sos.demo.v1`，version 仍為 1。只新增 optional `shItems`，舊資料冇此欄都可以讀，唔需要 reset。Availability schema 同 shift schema 保持原樣。

## Wallet error 調查

搜尋 `src`、public assets 同已安裝 JavaScript dependencies，未發現 `window.ethereum`／`ethereum.selectedAddress` 引用，app 亦冇 wallet SDK。

乾淨 Chromium browser session 中 `window.ethereum` 不存在，calendar／rota／SH 操作冇 uncaught page errors；另一頁設置會在存取 ethereum 時拋錯嘅 getter，app 仍正常，證明現有流程唔依賴 provider。

未有原本 Safari／wallet browser 嘅 stack trace，**未能確認原錯誤係邊個 script 造成**。Browser extension／in-app browser 注入 script 仍係可能來源，但唔當成已證實原因。唔會加入假 ethereum object 或修改 wallet provider 去掩蓋外來錯誤。若仍重現，可用冇 wallet extension 嘅 Safari 比較，並提供錯誤 stack 同 source URL（毋須提供 wallet、key 或帳戶資料）。

## 驗證

- `npm run lint`：通過。
- `npm test`：38 tests passed，涵蓋月曆日期、切換月份、跨年七日、duplicate policy、V1 persistence、SH CRUD validation／visibility／工時隔離，同原本 overlap、availability status 同工時計算。
- `npm run build`：TypeScript 同 production build 通過。
- `npm run test:browser`：production server 上以 Chromium 驗證多日期選取／取消、跨月保留、invalid form disabled、duplicate-to-edit、手機 modal 滾動、375／390px 七欄、週導航及詳細資料、SH 新增／修改／刪除／發佈、zero hours、工作與 SH 衝突、Staff visibility、reload persistence、ethereum absent 同 guarded provider。
- 已目視手機 calendar、七日 rota 同 desktop 截圖。未用真實 iPhone Safari、iOS toolbar／safe-area hardware 或原本出錯嘅 wallet browser 驗證。冇宣稱修復 GitHub Codespaces provisioning。

## 重現 browser tests

已加入 Playwright 作 dev dependency。第一次喺冇 Chromium 嘅機器：

```bash
npm install
npx playwright install chromium
npm run build
npm start -- --port 3002
```

另一個 terminal（同一 repository）：

```bash
npm run test:browser
```

測試用獨立瀏覽器 context，唔影響你平時用 app 嘅 localStorage。預設 BASE_URL 為 `http://localhost:3002`；可用 BASE_URL 環境變數改本機網址。CHROMIUM_PATH 可以指定已安裝 browser；否則使用 Playwright Chromium。

## iPhone 預覽

切換到 `feat/sos-v3`，`npm install` 後 `npm run dev`。如果使用 Codespaces，保持 forwarded port Private，用 iPhone 登入同一 GitHub 帳戶，再開 Ports 面板嘅 forwarded URL。

如果 Codespaces 仍無法建立，可喺自己電腦同 iPhone 連同一個可信 Wi-Fi，電腦啟動 app，用 iPhone 開 `http://電腦區域網絡IP:3000`。呢個係區域網絡開發預覽，唔係公開部署；電腦 firewall 需要容許 local port。唔好將 router port forward 到公網。

未加入 Supabase、真實登入或 paid services。仍未支援跨午夜工作更、break deductions、多人同步。
