import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import { Providers } from "./providers"
import { initAnalytics } from "@/lib/analytics"
import "./globals.css"

// Initialize analytics on the client side
if (typeof window !== "undefined") {
  initAnalytics()
}

// Load Inter font
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
})

// Metadata
export const metadata: Metadata = {
  title: {
    template: "%s | SaaS Platform",
    default: "SaaS Platform",
  },
  description: "A multi-tenant SaaS platform with comprehensive features",
  keywords: ["saas", "platform", "multi-tenant", "dashboard", "analytics"],
  authors: [{ name: "SaaS Platform Team" }],
  creator: "SaaS Platform",
  publisher: "SaaS Platform",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
}

// Viewport
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
