import type React from "react"
import type { ReactElement } from "react"
import { render, type RenderOptions } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "next-themes"
import { I18nextProvider } from "react-i18next"
import i18n from "@/lib/i18n"
import { TenantProvider } from "@/lib/tenant-context"
import { ThemeProvider as CustomThemeProvider } from "@/lib/theme-context"

// Create a custom render function that includes providers
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <TenantProvider>
            <CustomThemeProvider>{children}</CustomThemeProvider>
          </TenantProvider>
        </ThemeProvider>
      </I18nextProvider>
    </QueryClientProvider>
  )
}

const customRender = (ui: ReactElement, options?: Omit<RenderOptions, "wrapper">) =>
  render(ui, { wrapper: AllTheProviders, ...options })

// Re-export everything from testing-library
export * from "@testing-library/react"

// Override render method
export { customRender as render }
