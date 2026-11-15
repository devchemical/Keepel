# Use one shared shell for authenticated product views

Keepel renders one persistent application shell around authenticated product views while keeping the anonymous landing, guest-only authentication routes, auth callbacks and auth error pages outside it. The authenticated dashboard stays at `/`; it and the complete `/vehicles` hierarchy share the same mounted top bar, desktop navigation rail, mobile drawer, account controls and main-content landmark. The public `/privacidad` route uses that shell contextually when the visitor is authenticated and keeps the public layout when anonymous. The shell boundary sits in `AppProviders` and chooses presentation from the server-seeded auth projection and the pathname; route membership never replaces server-side authentication or authorization.

## Consequences

- Future authenticated product areas opt into the shell explicitly. Authentication alone does not place a public route inside it; `/privacidad` is an explicit contextual exception and remains public and indexable.
- Navigation changes the main view without remounting the shell. The browser-local rail preference survives navigation and reloads, each destination starts at the top, and the mobile drawer closes after a destination is chosen.
- Private loading, empty and recoverable error states render inside the shell, so view pages and their `loading.tsx` render content only and never the public `Layout`. Session expiry on a private route still redirects to login. External session loss on `/privacidad` keeps the policy visible and switches it to the public layout; an explicit logout keeps the established redirect to login.
- The legacy per-vehicle header selector is not carried into the shell. The public header keeps its authenticated branch only for the few non-shell pages an authenticated person can still reach.
- The account area orders identity, Privacy, cookie preferences and logout. Its rows share one flex anatomy (height, padding, gap, fixed icon column) across the expanded rail, the compact rail and the drawer, and compact rows keep their labels for assistive technology. Privacy is marked current on authenticated `/privacidad`.
- Cookie preferences remain the existing overlay. Opening it from the mobile drawer closes the drawer first so two modal surfaces are never stacked, and focus returns to the drawer trigger when the overlay closes.
- The rail occupies the bottom-left corner, so the Next.js development indicator is moved to the bottom right.
- A richer avatar account popover remains separate follow-up work.
