# Galaxy Tab A8 SM-X200 安裝及長期運行

## 你會用邊個版本

推薦用「Fully Kiosk Browser + GitHub Pages PWA」。Profile、站牌及 PIN 仍只留在平板；GitHub Pages 只提供程式檔。畫面直接向 KMB、Citybus 及香港天文台官方公開 API 取資料。Fully Kiosk PLUS 負責真正熄屏／亮屏、開機自啟及鎖定 kiosk。

附帶 APK 只供快速試畫面或後備。APK 可 fullscreen、固定橫向及離線顯示 cache，但普通 Android app 沒有權限可靠地按時間喚醒已關閉的實體螢幕，所以單獨 APK 的夜間模式只會顯示黑畫面。

## A. 首次開啟 Dashboard

1. 將 Galaxy Tab 連接可靠 Wi-Fi。
2. 網址為：<https://jimoswang.github.io/home-dashboard/>
3. 首次載入完成後，PWA 會保留必要程式及離線 cache。

## B. 安裝 Fully Kiosk Browser

1. 從 Fully Kiosk 官方網站下載 Fully Kiosk Browser APK。建議用官網 APK 版，因 Android 11+ 的 scoped storage 限制較容易處理。
2. Samsung 設定允許該瀏覽器／檔案管理器「安裝未知應用程式」，然後安裝。
3. 首次開啟時批出所需權限；如見到「All files access / 管理所有檔案」，請允許。
4. Fully 的 PLUS 功能可先免費試用；長期使用 sleep schedule、JavaScript Interface 及 kiosk 功能需要 PLUS 授權。

## C. Fully 必要設定

在 Fully 左邊緣向右掃入 Settings：

### Web Content Settings

- Start URL：`https://jimoswang.github.io/home-dashboard/`
- Wait for Network Connection：Off（斷網時仍可顯示 cache）
- URL Whitelist：留空；或只允許本機及以下官方 API 網域：
  - `https://jimoswang.github.io/home-dashboard/*`
  - `https://data.etabus.gov.hk/*`
  - `https://rt.data.gov.hk/*`
  - `https://data.weather.gov.hk/*`
  - `https://www.hko.gov.hk/wxinfo/radars/*`

### Advanced Web Settings

- Localhost File Access：Off
- Enable JavaScript Interface：On
- Dark Mode：Off（Dashboard 自己已有 dark theme）
- Webview Content Debugging：完成驗收後 Off

JavaScript Interface 只應在可信任頁面開啟。鎖定 URL Whitelist，並不要用 Fully 隨意瀏覽其他網站。

### Web Auto Reload

- Auto Reload on Screen On：On
- Auto Reload on Network Reconnect：On
- Delete Webstorage on Auto Reload：Off
- Delete Cache on Auto Reload：Off

最後兩項必須保持 Off，否則會刪除 Profile、PIN 或離線 cache。

### Device Management Settings

- Screen Orientation：Landscape
- Keep Screen On：On
- Launch on Boot / Autostart：On
- Unlock Screen：On
- Prevent Sleep：On
- Screen Brightness：按實際環境調至舒適，建議不要長期最高亮度

### Kiosk Mode

- Enable Kiosk Mode：On
- 設定一個只有管理員知道的 Fully Kiosk PIN
- 啟用 Device Administrator（真正熄屏需要）
- 按提示批出 Draw over other apps、Usage Access 及 Disable battery optimization

## D. Dashboard 首次設定

1. 返回主畫面；預設會見到 289K 大學站。
2. 長按左上角時間 3 秒。
3. 首次進入 Settings 不需要舊 PIN；先建立 6 位 Admin PIN，否則不能儲存。
4. 設定 Profile 名稱、HKO 測站、巴士站、ETA 數量及更新頻率。
5. 夜間設定預設為 20:00 Sleep、06:30 Wake；亦可選「長開螢幕」。
6. 按「同步至 Fully Kiosk」，確認畫面提示已同步。
7. 按「儲存 Save」。
8. 用「匯出 JSON」保存設定備份；安全起見，備份不包含 Admin PIN。

## E. 加入／更改巴士站

1. Settings →「加入巴士站」。
2. 輸入路線，例如 `289K`，按 Search。
3. 選營辦商、方向及服務類型。
4. 用中文或英文搜尋站名，再選正確站牌。
5. 如為聯營線，可加入相同站名的另一營辦商來源；畫面會合併及去除重複 ETA。
6. 選 1–3 個 ETA 並儲存。循環線會按選中的精確站序查詢，不會只靠站名混合去程／回程。

## F. Samsung 系統設定

- Settings → Battery and device care → Battery：將 Fully Kiosk 設為 Unrestricted／不受限制。
- 關閉 Fully Kiosk 自動移入 Sleeping apps。
- Screen timeout 可保持一般值；Fully 的 Keep Screen On 會在運行時接管。
- 關閉自動旋轉並固定橫向，作雙重保險。
- 如長期插電，啟用 Samsung Battery protection；保持平板通風，避免長期高亮度。
- 重新開機一次，驗收 Fully 是否自動啟動並直接進入 Dashboard。

## G. 驗收清單

- 開機後毋須按 app icon，直接顯示 Dashboard。
- 畫面固定橫向、無狀態列及導覽列。
- 289K 大學站只取 ST906 站序 1，顯示最多 3 班。
- 拔走 Wi-Fi 後整頁不白屏；會顯示 Offline／cached／最後更新時間。
- 重新連線後自動更新。
- 長按時間不足 3 秒不會進 Settings；3 秒後需要 6 位 PIN。
- Profile 可直接切換，不需要 PIN。
- 20:00 真正關閉螢幕；06:30 自動亮起並回到 Dashboard。
- 匯出 JSON 後可重新匯入；JSON 內沒有 Admin PIN。

## 更新版本

GitHub Pages 發布新版後，Fully 會在重新載入時取得更新；Profile、PIN 及站牌設定會保留。仍建議定期匯出 JSON 備份。

如改用新版 APK，直接安裝覆蓋即可；必須使用同一簽章。不要先解除安裝，否則 APK 內的本機設定會被刪除。
