# Flow Lite shared-data setup

This build uses Google Sheets as the shared source of truth. Local storage is only a temporary cache.

## Install the Apps Script

1. Open the Google Sheet for Flow.
2. Choose **Extensions → Apps Script**.
3. Replace the existing script with `google-apps-script/Code.gs`.
4. Save.
5. Run `setupFlowSheet` once and approve access.

## Deploy the latest script

1. Choose **Deploy → Manage deployments**.
2. Edit the web-app deployment.
3. Select **New version**.
4. Set **Execute as** to **Me**.
5. Set **Who has access** to **Anyone**.
6. Deploy.
7. Copy the `/exec` URL into `js/config.js`.

Saving `Code.gs` does not update the deployed web app. A new version must be deployed.

## Confirm it works

Open the `/exec` URL. It should say the Flow API is running.

Then open:

`YOUR_EXEC_URL?action=getData`

It should return JSON containing `"ok": true`.

## Two-device test

1. Open Flow on both devices.
2. Update a cage on device A.
3. Confirm the `Updated At` cell changes in the `FlowData` tab.
4. Bring Flow back to the front on device B.
5. Open the same cage.

The cage screen displays **Shared data up to date** when the connection is working.

## iPhone testing

Use a changing query value after each GitHub Pages deployment:

`https://YOUR-SITE.github.io/FlowLite/?v=20260726`

Changing the value after `v=` makes Safari request the newest page.
