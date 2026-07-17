import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { AuthProjectionProvider, useAuthProjection } from "@/contexts/AuthProjectionContext"
import { AUTH_ERROR_CODE, AUTH_STATE_STATUS } from "@/lib/auth/contracts"
import { createAuthServerApi } from "@/lib/auth/server-boundary"
import { createControlledAuthServerAdapter } from "@/tests/support/controlled-auth-server-adapter"

function ProjectionProbe() {
  const state = useAuthProjection()

  return createElement(
    "span",
    null,
    state.status === AUTH_STATE_STATUS.AUTHENTICATED ? state.user.displayName : "anonymous"
  )
}

describe("server authentication boundary", () => {
  it("projects only the public user fields returned to consumers", async () => {
    const adapter = createControlledAuthServerAdapter({
      id: "user-1",
      email: "driver@example.com",
      userMetadata: {
        name: "Ada Driver",
        role: "admin",
      },
    })
    const auth = createAuthServerApi(adapter)

    const user = await auth.getCurrentUser()

    expect(user).toEqual({
      id: "user-1",
      email: "driver@example.com",
      displayName: "Ada Driver",
    })
    expect(Object.keys(user ?? {})).toEqual(["id", "email", "displayName"])
  })

  it("returns an anonymous state and rejects a required missing user with a stable code", async () => {
    const auth = createAuthServerApi(createControlledAuthServerAdapter(null))

    await expect(auth.getAuthState()).resolves.toEqual({
      status: AUTH_STATE_STATUS.ANONYMOUS,
      user: null,
    })
    await expect(auth.requireCurrentUser()).rejects.toMatchObject({
      code: AUTH_ERROR_CODE.AUTHENTICATION_REQUIRED,
    })
  })

  it.each(["not-a-user", { id: 42 }, { id: "" }, { id: "user-1", email: 42 }, { id: "user-1", userMetadata: [] }])(
    "rejects malformed user data returned by the external adapter",
    async (providerUser) => {
      const auth = createAuthServerApi(createControlledAuthServerAdapter(providerUser))

      await expect(auth.getCurrentUser()).rejects.toMatchObject({
        code: AUTH_ERROR_CODE.PROVIDER_ERROR,
      })
    }
  )

  it.each([
    [{ name: "  Ada Driver  " }, "driver@example.com", "Ada Driver"],
    [{ full_name: "Grace Driver" }, "driver@example.com", "Grace Driver"],
    [{}, "driver@example.com", "driver"],
    [{}, null, "Usuario"],
  ])("derives a stable display name from safe provider fields", async (userMetadata, email, expected) => {
    const auth = createAuthServerApi(
      createControlledAuthServerAdapter({
        id: "user-1",
        email,
        userMetadata,
      })
    )

    await expect(auth.getCurrentUser()).resolves.toMatchObject({ displayName: expected })
  })

  it("initializes the React projection with the state resolved by the server", async () => {
    const auth = createAuthServerApi(
      createControlledAuthServerAdapter({
        id: "user-1",
        email: "driver@example.com",
        userMetadata: { full_name: "Ada Driver" },
      })
    )
    const initialState = await auth.getAuthState()

    const markup = renderToStaticMarkup(
      createElement(AuthProjectionProvider, { initialState }, createElement(ProjectionProbe))
    )

    expect(markup).toBe("<span>Ada Driver</span>")
  })
})
