import { getRequiredConsentSigningSecret } from "./lib/privacy/config.mjs"
import { validateRateLimitEnvironment } from "./lib/config/rate-limit-environment.mjs"

getRequiredConsentSigningSecret()
validateRateLimitEnvironment()

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  poweredByHeader: false,
  // The authenticated navigation rail owns the bottom-left corner, where the dev indicator would cover its controls.
  devIndicators: { position: "bottom-right" },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
    ]
  },
  // Empty turbopack config to silence the Turbopack warning
  turbopack: {},
}

export default nextConfig
