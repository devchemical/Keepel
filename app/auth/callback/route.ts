import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  try {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get("code")
    const error = searchParams.get("error")
    const next = searchParams.get("next") ?? "/"

    // Si hay un error de OAuth
    if (error) {
      return NextResponse.redirect(`${origin}/auth/error?message=${encodeURIComponent(error)}`)
    }

    // Si no hay código, redirigir a error
    if (!code) {
      return NextResponse.redirect(`${origin}/auth/error?message=${encodeURIComponent("No authorization code")}`)
    }

    // Intentar intercambiar el código por una sesión
    const supabase = await createClient()
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (exchangeError) {
      return NextResponse.redirect(`${origin}/auth/error?message=${encodeURIComponent(exchangeError.message)}`)
    }

    if (!data?.user) {
      return NextResponse.redirect(`${origin}/auth/error?message=${encodeURIComponent("No user found")}`)
    }

    // Éxito - redirigir al destino
    return NextResponse.redirect(`${origin}${next}`)
  } catch (error) {
    console.error("Auth callback error:", error)
    const { origin } = new URL(request.url)
    return NextResponse.redirect(`${origin}/auth/error?message=${encodeURIComponent("Callback failed")}`)
  }
}
