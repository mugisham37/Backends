import { apiGet, apiPost, apiPut, apiDelete } from "./api"
import { trackEvent } from "./analytics"
import { toast } from "@/components/ui/use-toast"
import Cookies from "js-cookie"

export interface Plan {
  id: string
  name: string
  description: string
  price: number
  currency: string
  interval: "month" | "year"
  features: string[]
  limits: {
    users: number
    projects: number
    storage: number
    apiCalls: number
  }
  isPopular?: boolean
  isCustom?: boolean
  createdAt: string
  updatedAt: string
}

export interface Subscription {
  id: string
  tenantId: string
  planId: string
  plan: Plan
  status: "active" | "canceled" | "past_due" | "trialing" | "incomplete"
  currentPeriodStart: string
  currentPeriodEnd: string
  cancelAtPeriodEnd: boolean
  trialEnd?: string
  quantity: number
  paymentMethodId?: string
  paymentMethod?: PaymentMethod
  createdAt: string
  updatedAt: string
}

export interface PaymentMethod {
  id: string
  type: "card" | "bank_account" | "other"
  brand?: string
  last4?: string
  expiryMonth?: number
  expiryYear?: number
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export interface Invoice {
  id: string
  tenantId: string
  subscriptionId: string
  amount: number
  currency: string
  status: "draft" | "open" | "paid" | "uncollectible" | "void"
  dueDate: string
  paidAt?: string
  lineItems: InvoiceLineItem[]
  createdAt: string
  updatedAt: string
}

export interface InvoiceLineItem {
  id: string
  invoiceId: string
  description: string
  amount: number
  quantity: number
  period?: {
    start: string
    end: string
  }
}

export interface Usage {
  id: string
  tenantId: string
  subscriptionId: string
  metric: string
  value: number
  period: string
  createdAt: string
  updatedAt: string
}

// Get available plans
export const getPlans = async (): Promise<Plan[]> => {
  return await apiGet<Plan[]>("/billing/plans", { cache: true })
}

// Get current subscription
export const getCurrentSubscription = async (): Promise<Subscription> => {
  return await apiGet<Subscription>("/billing/subscriptions/current", { cache: true })
}

// Create a checkout session for subscription
export const createCheckoutSession = async (
  planId: string,
  successUrl: string,
  cancelUrl: string,
): Promise<{ url: string }> => {
  try {
    const response = await apiPost<{ url: string }>("/billing/checkout", {
      planId,
      successUrl,
      cancelUrl,
    })

    trackEvent("subscription_checkout_started", {
      planId,
      timestamp: new Date().toISOString(),
    })

    return response
  } catch (error) {
    throw error
  }
}

// Update subscription (change plan)
export const updateSubscription = async (planId: string): Promise<Subscription> => {
  try {
    const subscription = await apiPut<Subscription>("/billing/subscriptions/current", { planId })

    toast({
      title: "Subscription updated",
      description: `Your subscription has been updated to ${subscription.plan.name}.`,
    })

    trackEvent("subscription_updated", {
      subscriptionId: subscription.id,
      planId,
      timestamp: new Date().toISOString(),
    })

    return subscription
  } catch (error) {
    throw error
  }
}

// Cancel subscription
export const cancelSubscription = async (cancelImmediately = false): Promise<Subscription> => {
  try {
    const subscription = await apiPost<Subscription>("/billing/subscriptions/current/cancel", {
      cancelImmediately,
    })

    toast({
      title: "Subscription canceled",
      description: cancelImmediately
        ? "Your subscription has been canceled immediately."
        : "Your subscription will be canceled at the end of the current billing period.",
    })

    trackEvent("subscription_canceled", {
      subscriptionId: subscription.id,
      cancelImmediately,
      timestamp: new Date().toISOString(),
    })

    return subscription
  } catch (error) {
    throw error
  }
}

// Resume canceled subscription
export const resumeSubscription = async (): Promise<Subscription> => {
  try {
    const subscription = await apiPost<Subscription>("/billing/subscriptions/current/resume")

    toast({
      title: "Subscription resumed",
      description: "Your subscription has been resumed successfully.",
    })

    trackEvent("subscription_resumed", {
      subscriptionId: subscription.id,
      timestamp: new Date().toISOString(),
    })

    return subscription
  } catch (error) {
    throw error
  }
}

// Get payment methods
export const getPaymentMethods = async (): Promise<PaymentMethod[]> => {
  return await apiGet<PaymentMethod[]>("/billing/payment-methods", { cache: true })
}

// Add a payment method
export const addPaymentMethod = async (paymentMethodId: string): Promise<PaymentMethod> => {
  try {
    const paymentMethod = await apiPost<PaymentMethod>("/billing/payment-methods", { paymentMethodId })

    toast({
      title: "Payment method added",
      description: "Your payment method has been added successfully.",
    })

    trackEvent("payment_method_added", {
      paymentMethodId: paymentMethod.id,
      timestamp: new Date().toISOString(),
    })

    return paymentMethod
  } catch (error) {
    throw error
  }
}

// Set default payment method
export const setDefaultPaymentMethod = async (paymentMethodId: string): Promise<PaymentMethod> => {
  try {
    const paymentMethod = await apiPut<PaymentMethod>(`/billing/payment-methods/${paymentMethodId}/default`)

    toast({
      title: "Default payment method updated",
      description: "Your default payment method has been updated successfully.",
    })

    trackEvent("payment_method_set_default", {
      paymentMethodId,
      timestamp: new Date().toISOString(),
    })

    return paymentMethod
  } catch (error) {
    throw error
  }
}

// Delete payment method
export const deletePaymentMethod = async (paymentMethodId: string): Promise<void> => {
  try {
    await apiDelete(`/billing/payment-methods/${paymentMethodId}`)

    toast({
      title: "Payment method removed",
      description: "Your payment method has been removed successfully.",
    })

    trackEvent("payment_method_removed", {
      paymentMethodId,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    throw error
  }
}

// Get invoices
export const getInvoices = async (limit = 10, offset = 0): Promise<{ invoices: Invoice[]; total: number }> => {
  return await apiGet<{ invoices: Invoice[]; total: number }>(`/billing/invoices?limit=${limit}&offset=${offset}`, {
    cache: true,
  })
}

// Get invoice by ID
export const getInvoiceById = async (invoiceId: string): Promise<Invoice> => {
  return await apiGet<Invoice>(`/billing/invoices/${invoiceId}`, { cache: true })
}

// Get invoice PDF
export const getInvoicePdf = async (invoiceId: string): Promise<Blob> => {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api"}/billing/invoices/${invoiceId}/pdf`,
    {
      headers: {
        Authorization: `Bearer ${Cookies.get("token")}`,
        "X-Tenant-ID": Cookies.get("tenantId") || "",
      },
    },
  )

  if (!response.ok) {
    throw new Error("Failed to download invoice PDF")
  }

  return await response.blob()
}

// Get usage statistics
export const getUsageStatistics = async (): Promise<Usage[]> => {
  return await apiGet<Usage[]>("/billing/usage", { cache: true })
}

// Create a billing portal session
export const createBillingPortalSession = async (returnUrl: string): Promise<{ url: string }> => {
  return await apiPost<{ url: string }>("/billing/portal", { returnUrl })
}

// Apply a coupon to the subscription
export const applyCoupon = async (couponCode: string): Promise<Subscription> => {
  try {
    const subscription = await apiPost<Subscription>("/billing/subscriptions/current/apply-coupon", { couponCode })

    toast({
      title: "Coupon applied",
      description: "The coupon has been applied to your subscription successfully.",
    })

    trackEvent("coupon_applied", {
      subscriptionId: subscription.id,
      couponCode,
      timestamp: new Date().toISOString(),
    })

    return subscription
  } catch (error) {
    throw error
  }
}
