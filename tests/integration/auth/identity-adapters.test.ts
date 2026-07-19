import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { syncAuthAnalytics } from "@/components/analytics/auth-analytics-adapter"
import { HeaderUserIdentity } from "@/components/layout/header-user-identity"
import { AUTH_STATE_STATUS, type CurrentUser, type UserId } from "@/lib/auth/contracts"

const currentUser: CurrentUser = {
  id: "user-1" as UserId,
  email: "driver@example.com",
  displayName: "Ada Driver",
}

describe("auth identity adapters", () => {
  it("renders email and visible name from the server-projected CurrentUser", () => {
    const markup = renderToStaticMarkup(createElement(HeaderUserIdentity, { user: currentUser }))

    expect(markup).toContain("Ada Driver")
    expect(markup).toContain("driver@example.com")
  })

  it("identifies the authenticated projection through an external analytics adapter", () => {
    const events: unknown[] = []

    syncAuthAnalytics(
      { status: AUTH_STATE_STATUS.AUTHENTICATED, user: currentUser },
      {
        identifyUser(userId, properties) {
          events.push(["identify", userId, properties])
        },
        resetIdentification() {
          events.push(["reset"])
        },
      }
    )

    expect(events).toEqual([
      [
        "identify",
        "user-1",
        {
          email: "driver@example.com",
          firstName: "Ada Driver",
        },
      ],
    ])
  })

  it("resets analytics identity when the server projection becomes anonymous", () => {
    const events: string[] = []

    syncAuthAnalytics(
      { status: AUTH_STATE_STATUS.ANONYMOUS, user: null },
      {
        identifyUser() {
          events.push("identify")
        },
        resetIdentification() {
          events.push("reset")
        },
      }
    )

    expect(events).toEqual(["reset"])
  })
})
