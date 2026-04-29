import type React from "react"
import type { Metadata } from "next"
import { Inter, JetBrains_Mono } from "next/font/google"
import { OpenPanelComponent } from "@openpanel/nextjs"
import { AppProviders } from "@/contexts"
import "./globals.css"

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
})

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Keepel - Gestión de Mantenimiento Automotriz",
  description: "Gestiona el mantenimiento de todos tus vehículos desde una sola plataforma",
  generator: "Next.js",
  keywords: ["vehículos", "mantenimiento", "carros", "mecánica", "servicio", "gestión"],
  authors: [{ name: "Keepel Team" }],
  creator: "Keepel",
  publisher: "Keepel",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL("https://keepel.chemicaldev.com"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "es_ES",
    url: "https://keepel.chemicaldev.com",
    title: "Keepel - Gestión de Mantenimiento Automotriz",
    description: "Gestiona el mantenimiento de todos tus vehículos desde una sola plataforma",
    siteName: "Keepel",
    images: [
      {
        url: "/logo_keepel_grueso.svg",
        width: 444,
        height: 345,
        alt: "Keepel Logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Keepel - Gestión de Mantenimiento Automotriz",
    description: "Gestiona el mantenimiento de todos tus vehículos desde una sola plataforma",
    images: ["/logo_keepel_grueso.svg"],
  },
  verification: {
    google: "google-site-verification-token",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}>
      <head>
        <meta name="theme-color" content="#0f172a" media="(prefers-color-scheme: dark)" />
        <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
        <meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1, shrink-to-fit=no" />
        <link rel="icon" type="image/svg+xml" href="/logo_keepel_grueso.svg" />
      </head>
      <body className="font-sans" suppressHydrationWarning={true}>
        <OpenPanelComponent
          clientId="3fa7d07b-d3dc-4091-8f22-af8bd3adacca"
          apiUrl="https://openpanel.chemicaldev.com/api"
          trackScreenViews={false}
          trackOutgoingLinks={false}
          trackAttributes={false}
        />
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  )
}
