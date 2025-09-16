"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { toast } from "react-hot-toast"
import { CreditCard, AlertCircle } from "lucide-react"
import { SubscriptionCard } from "./subscription-card"
import { PaymentMethodCard } from "./payment-method-card"
import {
  getPricingPlans,
  getCurrentSubscription,
  createCheckoutSession,
  cancelSubscription,
  reactivateSubscription,
  getPaymentMethods,
  createCustomerPortalSession,
} from "@/lib/subscription"
import type { PricingPlan, Subscription, PaymentMethod } from "@/lib/subscription"

export function SubscriptionManagement() {
  const [plans, setPlans] = useState<PricingPlan[]>([])
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [plansData, subscriptionData, paymentMethodsData] = await Promise.all([
          getPricingPlans(),
          getCurrentSubscription().catch(() => null),
          getPaymentMethods().catch(() => []),
        ])

        setPlans(plansData)
        setSubscription(subscriptionData)
        setPaymentMethods(paymentMethodsData)
      } catch (error) {
        toast.error("Failed to load subscription data")
        console.error(error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

  const handleSelectPlan = async (planId: string) => {
    setIsProcessing(true)
    try {
      const { url } = await createCheckoutSession(planId)
      window.location.href = url
    } catch (error) {
      toast.error("Failed to create checkout session")
      console.error(error)
      setIsProcessing(false)
    }
  }

  const handleCancelSubscription = async () => {
    setIsProcessing(true)
    try {
      const updatedSubscription = await cancelSubscription()
      setSubscription(updatedSubscription)
      setShowCancelConfirm(false)
      toast.success("Subscription cancelled successfully")
    } catch (error) {
      toast.error("Failed to cancel subscription")
      console.error(error)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleReactivateSubscription = async () => {
    setIsProcessing(true)
    try {
      const updatedSubscription = await reactivateSubscription()
      setSubscription(updatedSubscription)
      toast.success("Subscription reactivated successfully")
    } catch (error) {
      toast.error("Failed to reactivate subscription")
      console.error(error)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleManagePaymentMethods = async () => {
    setIsProcessing(true)
    try {
      const { url } = await createCustomerPortalSession()
      window.location.href = url
    } catch (error) {
      toast.error("Failed to open customer portal")
      console.error(error)
      setIsProcessing(false)
    }
  }

  // Format date to readable format
  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A"
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 rounded w-1/4 animate-pulse"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-80 bg-gray-200 rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Subscription Management</h1>

      {subscription && (
        <Card>
          <CardHeader>
            <CardTitle>Current Subscription</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium text-gray-500">Plan</h3>
                <p className="text-lg font-medium">{subscription.plan}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Status</h3>
                <p className="text-lg font-medium capitalize">{subscription.status}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Start Date</h3>
                <p className="text-lg font-medium">{formatDate(subscription.startDate)}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">
                  {subscription.canceledAt ? "Cancellation Date" : "Next Billing Date"}
                </h3>
                <p className="text-lg font-medium">
                  {subscription.canceledAt ? formatDate(subscription.endDate) : formatDate(subscription.endDate)}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 mt-6">
              {subscription.status === "active" && !subscription.canceledAt && (
                <Button
                  variant="outline"
                  className="text-red-600 hover:bg-red-50"
                  onClick={() => setShowCancelConfirm(true)}
                  disabled={isProcessing}
                >
                  Cancel Subscription
                </Button>
              )}
              {subscription.status === "active" && subscription.canceledAt && (
                <Button onClick={handleReactivateSubscription} disabled={isProcessing}>
                  Reactivate Subscription
                </Button>
              )}
              <Button onClick={handleManagePaymentMethods} disabled={isProcessing}>
                <CreditCard className="h-4 w-4 mr-2" />
                Manage Payment Methods
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {showCancelConfirm && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-start space-x-4">
              <div className="p-2 bg-red-100 rounded-full">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-medium text-red-800">Cancel Subscription</h3>
                <p className="mt-1 text-sm text-red-700">
                  Are you sure you want to cancel your subscription? You will still have access to your current plan
                  until the end of your billing period.
                </p>
                <div className="mt-4 flex space-x-3">
                  <Button
                    variant="outline"
                    onClick={() => setShowCancelConfirm(false)}
                    disabled={isProcessing}
                    className="border-red-300 text-red-700 hover:bg-red-100"
                  >
                    Keep Subscription
                  </Button>
                  <Button
                    onClick={handleCancelSubscription}
                    disabled={isProcessing}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    {isProcessing ? "Processing..." : "Cancel Subscription"}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <h2 className="text-xl font-bold mt-8">Available Plans</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <SubscriptionCard
            key={plan.id}
            plan={plan}
            isCurrentPlan={subscription?.plan === plan.name}
            onSelect={handleSelectPlan}
            isLoading={isProcessing}
          />
        ))}
      </div>

      {paymentMethods.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-bold mb-4">Payment Methods</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {paymentMethods.map((method) => (
              <PaymentMethodCard key={method.id} paymentMethod={method} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
