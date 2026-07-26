# Flow Lite shared Google Sheet setup

This version reads and writes one shared Flow state through Google Apps Script. LocalStorage remains only as a fallback cache.

## 1. Open the Google Sheet used by Flow

Open **Extensions → Apps Script**.

## 2. Replace the Apps Script code

Copy everything from:

`google-apps-script/Code.gs`

Paste it into `Code.gs` in Apps Script and save.

## 3. Prepare the sheet

In Apps Script, select `setupFlowSheet` and click **Run** once.

Approve the requested Google permissions. A tab named `FlowData` will be created.

## 4. Deploy the web app

Choose **Deploy → Manage deployments**.

Edit the existing web-app deployment, or create a new one with:

- Execute as: **Me**
- Who has access: **Anyone**

Deploy and copy the `/exec` URL.

## 5. Check the Flow URL

Open `js/config.js` and make sure `apiUrl` contains that exact `/exec` URL.

If you updated the existing deployment, the URL may remain unchanged.

## 6. Commit and test

Commit the changed project and wait for GitHub Pages to update.

Test with two devices:

1. Open Flow on both devices.
2. Scan or update a cage on device one.
3. Refresh Flow on device two.
4. The same cage state should appear.

## Important MVP limitation

This first shared version saves the full state as one locked JSON record. It is suitable for the demonstration and a small trial. Two people saving at almost exactly the same moment could still cause the last save to win. The later event-log API will remove that limitation by accepting individual events rather than replacing the whole state.
