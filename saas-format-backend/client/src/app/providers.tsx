"use client"

import type React from "react"

import { useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { ThemeProvider as NextThemesProvider } from "next-themes"
import { I18nextProvider } from "react-i18next"
import { Toaster } from "@/components/ui/toaster"
import { TenantProvider } from "@/lib/tenant-context"
import { ThemeProvider } from "@/lib/theme-context"
import i18n from "@/lib/i18n"
import { usePageViewTracking } from "@/lib/analytics"

export function Providers({ children }: { children: React.ReactNode }) {
  // Create a client
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  )

  // Track page views
  usePageViewTracking()

  return (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <NextThemesProvider attribute="class" defaultTheme="system" enableSystem>
          <TenantProvider>
            <ThemeProvider>
              {children}
              <Toaster />
            </ThemeProvider>
          </TenantProvider>
        </NextThemesProvider>
      </I18nextProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
