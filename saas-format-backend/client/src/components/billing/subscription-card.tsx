"use client"

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Check } from "lucide-react"
import type { PricingPlan } from "@/lib/subscription"

interface SubscriptionCardProps {
  plan: PricingPlan
  isCurrentPlan?: boolean
  onSelect: (planId: string) => void
  isLoading?: boolean
}

export function SubscriptionCard({ plan, isCurrentPlan = false, onSelect, isLoading = false }: SubscriptionCardProps) {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(price)
  }

  return (
    <Card className={`flex flex-col h-full ${isCurrentPlan ? "border-blue-500 shadow-md" : ""}`}>
      {isCurrentPlan && <div className="bg-blue-500 text-white text-center py-1 text-sm font-medium">Current Plan</div>}
      <CardHeader>
        <CardTitle className="text-xl">{plan.name}</CardTitle>
        <div className="mt-2">
          <span className="text-3xl font-bold">{formatPrice(plan.price)}</span>
          <span className="text-gray-500 ml-1">/{plan.interval}</span>
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        <p className="text-gray-600 mb-6">{plan.description}</p>
        <ul className="space-y-3">
          {plan.features.map((feature, index) => (
            <li key={index} className="flex items-start">
              <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter>
        <Button
          onClick={() => onSelect(plan.id)}
          className={`w-full ${isCurrentPlan ? "bg-gray-300 hover:bg-gray-400" : ""}`}
          disabled={isCurrentPlan || isLoading}
        >
          {isLoading ? "Processing..." : isCurrentPlan ? "Current Plan" : `Select ${plan.name}`}
        </Button>
      </CardFooter>
    </Card>
  )
}
