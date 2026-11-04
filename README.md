# SOS — Café staff scheduling

SOS 係一個適合手機使用嘅咖啡店排更 prototype。介面使用 English，支援 **ST、CSW、SOHO W** 三間分店，同六位虛構員工。

**呢個版本只係示範：冇真正登入、冇雲端同步、冇資料庫，唔好輸入真實員工資料。** Staff Demo／Manager Demo 只係介面模擬，唔係權限或資料安全措施。

## 開始使用（GitHub Codespaces）

1. 喺 GitHub 開啟呢個 repository，揀包含 SOS prototype 嘅 branch（例如 `feat/sos-prototype`）。
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
git switch feat/sos-prototype
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
- 喺 Availability inbox 嘅 **Preview as** 揀示範員工。
- 按 **+ Availability**，揀日期後按 **Add date**。可重複加入多個日期，亦可以移除日期。
- 填 Earliest start／Latest finish，或者勾 All-day availability；揀一間或多間 preferred branches，最後按 **Submit availability**。
- 員工只會見到自己嘅 availability；經理會見到全部。Availability 可以 Remove，並唔會自動變成班次。

### Manager Demo

- 按右上 **Manager Demo**，再按 **Add shift**。
- 揀員工、日期、分店、開始／完結時間同 Draft／Published。
- 按月曆入面嘅班次可以修改或刪除。刪除前會要求確認。
- **Publish N drafts** 會發佈目前月份同分店篩選內嘅 draft，唔會改動其他月份或分店。
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
- `test`：12 個 unit tests，涵蓋跨分店重疊、相連班次、修改、不同員工／日期、錯誤時間／日期、sample data 同 availability validation。
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
