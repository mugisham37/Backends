import type { ReactNode } from "react"
import Link from "next/link"
import { Home } from "lucide-react"

interface AuthLayoutProps {
  children: ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b py-4">
        <div className="container mx-auto px-4">
          <Link href="/" className="flex items-center space-x-2">
            <Home className="h-6 w-6 text-blue-600" />
            <span className="font-bold text-xl">SaaS Platform</span>
          </Link>
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center p-4">{children}</main>
      <footer className="bg-white border-t py-4">
        <div className="container mx-auto px-4 text-center text-sm text-gray-500">
          <p>© {new Date().getFullYear()} SaaS Platform. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
