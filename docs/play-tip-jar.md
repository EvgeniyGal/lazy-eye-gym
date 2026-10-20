# Google Play tip jar (Support development)

LazyEye Gym stays **free and ad-free**. Optional tips are **consumable** in-app products via Google Play Billing (`expo-iap`). Tips unlock nothing.

In-app product IDs (must match Play Console and `src/billing/tipJar.ts`):

| Product ID     | Suggested label (listing / UI) |
|----------------|--------------------------------|
| `tip_coffee`   | Coffee                         |
| `tip_boost`    | Boost an update                |
| `tip_champion` | Champion a new game            |

Prices are set in Play Console; the app shows localized `displayPrice` from the Billing API.

## Prerequisites

- Package: `com.lazyeyegym.app` (see `app.json`)
- EAS project linked (`extra.eas.projectId` in `app.json`)
- `expo-iap` installed and listed in `app.json` → `plugins`
- Physical Android device for IAP testing (emulators have limited Billing support)
- **Not Expo Go** — use an EAS development or production build

## 1. Install / rebuild after IAP changes

```bash
npx expo install expo-iap
```

Config plugin is already `"expo-iap"` in `app.json`. After adding or changing native modules:

```bash
# Development client (device testing)
npx eas-cli@latest build --platform android --profile development

# Production AAB for Play
npx eas-cli@latest build --platform android --profile production
```

Or locally: `npx expo run:android` (generates native projects via CNG; do not hand-edit `android/`).

## 2. Play Console — app & internal testing

1. Create the app in [Google Play Console](https://play.google.com/console) if needed (package `com.lazyeyegym.app`).
2. Complete **App content** / policy declarations (including a **privacy policy URL**).
3. Upload a production (or internal-test) **AAB** from EAS to **Internal testing**.
4. Add license testers (Settings → License testing) with the Google accounts you use on devices.
5. Install the internal-test build on a tester device signed into a license-tester account.

## 3. Create in-app products

Play Console → **Monetize** → **In-app products** → Create:

1. `tip_coffee` — one-time / **consumable**, status **Active**
2. `tip_boost` — consumable, **Active**
3. `tip_champion` — consumable, **Active**

Set default prices (and translations if desired). Wait 15–30 minutes after activating before first purchase tests.

Listing copy suggestion: *“Free, no ads. Optional tips support development.”* Prefer “tip” / “support” over “donate” or “subscribe”.

## 4. Test the tip flow

1. Open **Settings → Support development** (or the Home soft card).
2. Confirm three tips show localized prices.
3. Purchase each SKU once with a license tester; confirm thank-you UI.
4. Purchase the same SKU again (consumable) to verify repeat tips work.
5. Confirm Expo Go / web shows the “unavailable in this build” message (no crash).

## 5. Privacy policy (required for Play)

Host a short page stating:

- No ads
- Optional tips via Google Play Billing only
- Training prefs / history stay on-device (as today)

Add the URL in Play Console. An in-app Privacy link can point at the same URL when you have one.

## Explicit non-goals

- No subscriptions or paid plans  
- No ads / “remove ads”  
- No feature gating behind tips  
- No external payment links as the primary tip path on Play builds  
- App Store IAP can reuse the same product IDs / Support screen later  
