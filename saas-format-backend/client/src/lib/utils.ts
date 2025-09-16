import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength)}...`
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

export function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount)
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

export function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

export function generatePaginationArray(currentPage: number, totalPages: number, maxLength = 7): (number | null)[] {
  if (totalPages <= maxLength) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }

  const sideWidth = Math.floor(maxLength / 2)

  if (currentPage <= sideWidth) {
    return [...Array.from({ length: maxLength - 2 }, (_, i) => i + 1), null, totalPages]
  }

  if (currentPage >= totalPages - sideWidth) {
    return [1, null, ...Array.from({ length: maxLength - 2 }, (_, i) => totalPages - maxLength + i + 3)]
  }

  return [
    1,
    null,
    ...Array.from({ length: maxLength - 4 }, (_, i) => currentPage - Math.floor((maxLength - 4) / 2) + i),
    null,
    totalPages,
  ]
}
