# SOS — Café staff scheduling

SOS 係一個適合手機使用嘅咖啡店排更 prototype。介面使用 English，支援 **ST、CSW、SOHO W** 三間分店，同六位虛構員工。

**呢個版本只係示範：冇真正登入、冇雲端同步、冇資料庫，唔好輸入真實員工資料。** Staff Demo／Manager Demo 只係介面模擬，唔係權限或資料安全措施。

## 開始使用（GitHub Codespaces）

1. 喺 GitHub 開啟呢個 repository，揀包含 SOS prototype 嘅 branch（例如 `feat/sos-v4`）。
2. 按 **Code → Codespaces → Create codespace on [branch]**。
3. 等 VS Code 開好，喺上方選單按 **Terminal → New Terminal**。
4. 確認 terminal 已喺 repository 根目錄（見到 `package.json`），逐行輸入：

```bash
node --version
npm install
npm run dev
```

建議使用 **Node.js 22 或以上**（Next.js 最低要求 Node.js 20.9）。本次環境使用 Node.js 24。

5. 喺 **Ports** 面板搵到 `3000`，保持 **Private**，按 **Open in Browser**。如果冇自動顯示，按 **Add Port**，輸入 `3000`。
6. 要停止 app，返 terminal 按 **Ctrl+C**。

唔需要 `.env`、API key、Supabase account 或其他 service。唔需要部署。Codespaces 嘅 private forwarded port 係開發預覽，請唔好改成 public。

## 喺自己電腦啟動

安裝 Node.js 22+ 同 Git，然後：

```bash
git clone https://github.com/kyb723/SOS.git
cd SOS
git switch feat/sos-v4
npm install
npm run dev
```

合併之後可以改用 `main`。喺同一部電腦瀏覽器開啟 `http://localhost:3000`。本次 Codex checkout 位於 `/workspace/SOS`，可先 `cd /workspace/SOS`。

如果 port 3000 已使用，可以執行 `npm run dev -- --port 3001`，並喺 Ports 面板開啟 `3001`。

## 點樣試功能

### Staff Demo

- 預設只顯示所有同事嘅 **published shifts**，唔會顯示 draft。
- 左右滑動月曆睇晒成個月；員工名會固定喺左邊。
- 用 Previous／Next month 切換月份，Today 返回今個月。
- 揀 All Branches 或單一分店；分店卡顯示當月各分店可見班次數。
- 按 Availability → View / edit complete availability history，再用 **Preview as** 揀示範員工。
- 按 **+ Availability**，直接喺月曆點選多個日期，再點可取消，切換月份亦會保留選取。
- 喺月曆直接點選一日或多日，再填 Earliest start／Latest finish，或者勾 All-day availability；揀一間或多間 preferred branches，最後按 **Submit availability**。
- 員工只會見到自己嘅 availability；經理會見到全部。Availability 可以 Remove，並唔會自動變成班次。

### Manager Demo

- 按右上 **Manager Demo**，再按 **Add shift**。
- 揀員工、日期、分店、開始／完結時間同 Draft／Published。
- 按月曆入面嘅班次可以修改或刪除。刪除前會要求確認。
- **Publish Rota** 會先確認，再發佈目前月份所有分店嘅 valid draft；invalid drafts 會整批阻止。唔會改動其他月份。
- 同一員工喺同一日嘅時間唔可以重疊，無論分店、draft 定 published 都會檢查。
- 例如 Alex 已有 ST 08:00–16:00，新增 CSW 15:00–18:00 會被拒絕；16:00–18:00 則可以。
- 呢版未支援跨午夜班次。結束時間必須遲過開始時間。

### 儲存同 reset

改動會寫入同一個瀏覽器、同一個網址嘅 `localStorage`（key：`sos.demo.v1`）。Refresh 後仍然保留；換電腦、瀏覽器、網址或 Codespace 唔會自動同步。瀏覽器封鎖或冇足夠儲存空間時會顯示提示，當次操作仍可以繼續。

**Reset demo** 經確認後會用目前月份重新產生 sample data，並刪除 demo 改動。模式同篩選唔會儲存。空月份唔會自動新增班次。

`OFF` 表示目前視圖冇可見班次，唔代表正式批准休假；篩選分店或 Staff Demo 隱藏 draft 都可能見到 OFF。Availability 只係員工偏好，唔保證當日一定有更。

## 檢查程式

```bash
npm run lint
npm test
npm run build
npm start
```

- `lint`：檢查常見程式錯誤。
- `test`：48 個 unit tests，涵蓋跨分店重疊、相連班次、修改、不同員工／日期、錯誤時間／日期、sample data 同 availability validation。
- `build`：TypeScript 檢查同 production build。
- `start`：先完成 build，然後啟動 production server。請先停止 `dev`，避免用緊同一個 port。
- 有 lockfile 後，重現同一版本可用 `npm ci` 代替 `npm install`。
- `npm run format`：統一程式排版。

## 程式結構（之後接 Supabase）

```text
src/app/page.tsx        # 互動介面與操作流程
src/app/globals.css     # Dark theme、responsive layout、Tailwind entry
src/app/layout.tsx      # Next.js root layout 與 metadata
src/lib/scheduling.ts   # Types、sample data、純函式 validation
src/lib/storage.ts      # ScheduleRepository interface 與 localStorage adapter
tests/scheduling.test.ts
```

未來可以用 Supabase adapter 取代 `localScheduleRepository`，再將資料讀寫改成 async。真正上線之前需要 Supabase Auth、server-side validation、RLS 同 transaction／database constraints 防止多人同時排出重疊班次。依家嘅前端檢查唔可以當安全保障。唔好將任何 service-role key 放入 browser code。

## 設計與限制

使用 Taste Skill 嘅 app-screen 指引，同 Impeccable 主文件嘅 Operate mode：中性深色底、低干擾 navigation、綠色班次、draft 虛線、availability 外框、可橫向滑動月曆。冇複製 Dozy HR branding；本次冇收到參考截圖。Cloud skill 附屬腳本／部分 references 未能讀取，冇聲稱執行過 skill inspector。

呢個版本冇薪酬計算、法定休息規則、最低人手檢查、正式休假、跨午夜排更或多人同步。員工姓名同數據全部虛構。

## Version 2 更新

- **ST 綠色、CSW 暖橙色、SOHO W 淡紫色**：全部由 `globals.css` 嘅 branch tokens 控制；班次保留分店名稱，draft 用虛線同 Draft 字樣，published 用實線同 Live 字樣，唔需要單靠顏色辨認。
- **Availability inbox** 預設顯示所有月份、所有提交。經理可揀 All employees 或單一員工；Staff 只可管理 Preview as 所選員工。Inbox 有獨立 Optional month 篩選，按 All months 取消；上方 rota 嘅分店／月份篩選唔會隱藏歷史。
- 提交可以 **Edit／Remove**；多日期提交會整筆編輯或移除，唔影響已排班次。相同員工、日期、時間同分店組合唔可重複提交。儲存前有 Review before saving 摘要。
- 新提交有 Submitted timestamp（HKT）。舊資料冇記錄提交時間會顯示 Not recorded (legacy demo)，唔會虛構日期。編輯會保留原本 timestamp。
- 每位員工名旁顯示目前月份／分店篩選內嘅 **published scheduled hours**，Manager 另列 `+Nh draft`。無更顯示 0h；唔計 availability、唔扣 break，唔係 paid hours。整體工時統計如果包含 draft 亦有標示。
- 經理排更超出提交時間／分店，或冇提交 availability 時會見到 warning。呢個係提示，唔係硬性禁止；時間重疊依然唔容許。

### Availability 排更狀態定義

每個提交可以包含多日，狀態由目前班次即時計算：

- **Scheduled**：提交每一日都有班次，而且該日所有已排班次都完整落喺提交時間內，同時屬於可接受分店。
- **Partially Scheduled**：部分日期／時間已有符合分店且與可上班時間重疊嘅班次，但未達以上條件。
- **Not Scheduled**：冇符合日期、分店同時間交集嘅班次；單純同日有其他分店或完全超出時間嘅更唔會當已排。

Staff 用 published shifts 計算；Manager 包含 drafts，Inbox 會清楚標示。唔代表必須排滿整段 availability，亦唔代表最低人手已足夠。刪更後會重算狀態，提交紀錄仍保留。

沿用 `sos.demo.v1` 同 version 1 schema；只新增 backwards-compatible optional `submittedAt`。唔使 reset 舊資料。詳細驗證見 `docs/VERSION_2.md`。

## Version 3 更新

Availability 已改成直接點選多日嘅月曆，手機 rota 改為七日顯示，並加入獨立 SH 紀錄。V3 會阻止同員工同日期嘅新 availability（即使時間／分店不同）；請選 Update existing 或取消重複日期。完整操作、SH 設定、wallet error 調查、browser tests 同 iPhone 預覽方式，見 [Version 3 說明](docs/VERSION_3.md)。

## Version 4 更新

主頁集中 rota，availability history 移到 Availability 管理視窗。Manager 可以直接由 Av 格建立工作更，新增／編輯／發佈都必須符合提交嘅分店同單一時間段。All-day 依照明確 prototype branch hours。手機格仔直接顯示時間，SH 按鈕移到頂部同一操作列，圖例最後只顯示 SH。全月 Publish Rota 有確認、跨全部分店驗證，以及 localStorage 儲存失敗保護。舊 invalid 更會保留並標示，唔會靜默刪除。詳細操作、規則、48 tests 同 iPhone 預覽方式見 [Version 4 說明](docs/VERSION_4.md)。
