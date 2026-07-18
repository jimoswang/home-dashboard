# 屋企資訊板 Home Dashboard

一個為香港家庭而設、繁體中文＋英文並示的全螢幕家居資訊板。支援 Samsung Android 平板／手機及 iPad mini 4（iPadOS 15）或以上裝置。

正式網站：<https://jimoswang.github.io/home-dashboard/>

## V1 功能

- 大字時間、日期、香港天文台天氣／雨量／警告
- 天文台 128 公里雷達圖；6 分鐘更新、延遲提示、離線舊圖
- KMB/LWB 及 Citybus ETA；可合併聯營路線來源
- 多個 Profile，毋須 PIN 即可切換
- Settings 內搜尋路線、方向、站牌、排序、ETA 數量及更新頻率
- 6 位 Admin PIN；長按時間 3 秒進入 Settings
- Local Storage 設定、JSON 匯出／匯入（不包含 PIN）
- API timeout、retry、IndexedDB cache、offline fallback 及逐卡故障隔離
- KMB 熟悉版、dark mode、pixel shift、landscape kiosk layout
- Galaxy Tab A8 16:10 及 iPad mini 4 4:3 橫屏版面

所有 Profile、站牌及 PIN 只存於個別裝置，並不會上載到 GitHub。程式不包含 API secrets。

## 安裝

- Samsung Galaxy Tab A8：參閱 `INSTALL_GALAXY_TAB_A8.md`
- iPad mini 4：參閱 `INSTALL_IPAD_MINI_4.md`

預設 QC Profile 使用 KMB 289K、大學站、站序 1、往富安花園循環線；更新頻率 30 秒；顯示最多 3 班。實際使用時可於 Settings 更改，沒有把真實家庭站牌寫死。

## 開發與驗證

```bash
npm ci
npm run test
npm run build
```

每次推送到 `main`，GitHub Actions 會先測試、build，再自動部署 GitHub Pages。

資料來源：KMB、LWB、Citybus、香港天文台。此項目並非上述機構的官方產品。
