# Google OAuth manual verification

The automated auth integration tests cover Keepel's server initiation, PKCE callback exchange, cancellation, and stable error mapping. The Google consent screen itself requires this manual check against a configured Supabase project.

## Prerequisites

- Enable the Google provider in Supabase Auth.
- Add the Supabase Auth callback URL shown by the provider settings to the Google OAuth client.
- Add `http://localhost:3000/auth/callback` and the production callback URL to the Supabase redirect allow list.
- Configure Keepel's Supabase environment variables, then start the app with `bun dev`.

## Successful sign-in

1. Open `http://localhost:3000/auth/login?redirect=/vehicles` in a signed-out browser.
2. Select **Continuar con Google** and complete the Google consent screen.
3. Confirm that the browser returns to `/vehicles` and the authenticated UI is visible.
4. Reload `/vehicles` and confirm that the session remains authenticated through the Supabase SSR cookie.
5. In browser developer tools, confirm that the flow starts with `GET /auth/google`, and that no access token, refresh token, or session is written to local storage or exposed in a response body or URL.

## Cancellation

1. Start the flow again in a signed-out browser.
2. Cancel or deny the Google consent request.
3. Confirm that Keepel opens `/auth/error?error=oauth_cancelled`.
4. Confirm that the URL and page do not expose Google's error description, authorization code, or any token.
