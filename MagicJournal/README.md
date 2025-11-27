# Magic Journal iOS App

This folder contains the SwiftUI client for the Magic Journal project. The app now uses the same Google OAuth credentials as the web app and talks to the existing Flask backend. Configure it before running:

## 1. Configure local secrets

1. Copy `MagicJournal/MagicJournal/Configuration/Secrets.xcconfig.template` to `Secrets.xcconfig` in the same directory.
2. Fill in the values using the credentials you already use on the web app and a companion iOS client id:
   - `GOOGLE_IOS_CLIENT_ID` → the **iOS** OAuth client id from the same Google Cloud project. Create this in Google Cloud Console (`Credentials → Create Credentials → OAuth client ID → iOS`) and register your bundle id (`CSE.MagicJournal`).
   - `REVERSED_GOOGLE_IOS_CLIENT_ID` → the reversed URL scheme for the iOS client (`com.googleusercontent.apps.<ios-client-id>`). This is required so Google can hand control back to the app.
   - `GOOGLE_WEB_CLIENT_ID` → the existing web client id that your backend already trusts (e.g. `1234567890-abcdef.apps.googleusercontent.com`). It is passed to Google as the `serverClientID` so ID tokens validate against the backend without changes.
   - `BACKEND_BASE_URL` → the URL your phone/simulator can reach (see below).
3. `Secrets.xcconfig` is gitignored; the checked-in `AppConfig.xcconfig` provides safe defaults if you prefer to keep the values out of source control entirely.
4. Clean and build once so Xcode picks up the Swift Package dependency on `GoogleSignIn` and the refreshed build settings.

> Google blocks custom URL schemes for web client IDs, so using the web ID in place of the iOS ID will trigger the "custom scheme URIs are not allowed for 'WEB' client type" error. Make sure you copy the actual iOS client ID into `Secrets.xcconfig`.

## 2. Point the app at your backend

- In `Secrets.xcconfig`, set `BACKEND_BASE_URL` to the reachable address for the backend.
- When running on the iOS simulator, `http://127.0.0.1:5000` will continue to work.
- When running on a physical device, replace it with `http://<your-mac-ip>:5000` (see the next section to expose the backend).

## 3. Expose the backend to your phone

1. Make sure Docker is running and start the stack as usual (`docker-compose up backend` or the full compose file). The backend container already binds to the host on port 5000.
2. Find your Mac's LAN IP address (for example: `ipconfig getifaddr en0` on macOS). Suppose it prints `192.168.1.42`.
3. Ensure the iPhone is on the same Wi-Fi network and can reach that address. Then set `BACKEND_BASE_URL` to `http://192.168.1.42:5000`.
4. Because the app uses plain HTTP for local development, the plist already enables an App Transport Security exception. Switch to HTTPS when you deploy externally.

If you need to test from outside your network, expose port 5000 with a tunnelling tool such as [ngrok](https://ngrok.com/), [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/tunnel-guide/), or by creating an SSH reverse tunnel from a publicly reachable server. Update `BACKEND_BASE_URL` to the public URL provided by the tunnel.

## 4. Sign-in flow summary

1. The app launches into a Google Sign-In screen.
2. After Google returns an ID token, it is POSTed to `POST /api/auth/google` with `{"allow_create": false}`.
3. The backend verifies the token against the existing database. If the user is missing, the app displays an error telling them to create an account via the web experience.
4. Successful sign-in stores the Flask session cookie in the default `URLSession`, so subsequent API calls (e.g., `/api/auth/me`) work without extra tokens.
5. Users can sign out from the profile tab, which clears both the backend session and their Google session.

## 5. Next steps

- Wire additional app screens to the backend using the authenticated `APIClient`.
- Replace the ATS override with HTTPS before submitting to the App Store.
- Consider moving secrets to an `.xcconfig` file added to `.gitignore` so the Info.plist can refer to build settings rather than hard-coded values.
