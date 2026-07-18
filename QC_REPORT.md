# V1 QC Report — 2026-07-18

## Automated checks

- TypeScript production build: PASS
- Vitest: 4 test files, 7 tests, all PASS
- APK Gradle build: PASS
- APK signature verification: PASS (Android debug signing, v2)
- APK package: `hk.jimos.homedashboard`, minSdk 24, targetSdk 36
- Android activity: landscape locked, immersive fullscreen, keep-screen-on

## Live official API acceptance

At the time of the check, KMB's official stop ETA endpoint returned exactly three matching 289K departures after applying all acceptance filters:

- Stop ID: `888C8A612C998895`
- Route: `289K`
- Direction: `O`
- Service type: `1`
- Stop sequence: `1`
- Destination: 富安花園（循環線） / Chevalier Garden (Circular)

This confirms the QC profile does not mix the later return visit to University Station on the circular route.

HKO's official current-weather endpoint returned Sha Tin temperature and rainfall successfully. HKO warning summary also returned successfully and contained one active warning at check time.

## Resilience covered by tests/code review

- Request timeout and one retry
- IndexedDB last-good cache
- Cached/stale/unavailable UI states
- `Promise.allSettled` failure isolation between weather and each bus board
- Exact KMB stop-sequence filtering
- Joint-operator ETA de-duplication
- PIN hash/verification and no-PIN JSON export
- Cross-midnight 20:00–06:30 schedule logic

## Device acceptance still required

The following hardware behaviours must be checked on the actual Galaxy Tab A8 SM-X200 because Samsung firmware and granted Fully Kiosk permissions affect them:

- Fully autostart after reboot
- Physical screen off at 20:00 and wake at 06:30
- Status/navigation bar lockdown
- Comfortable type size and brightness at the final mounting distance
- Wi-Fi reconnect after an overnight sleep

