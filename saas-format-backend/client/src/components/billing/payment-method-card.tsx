import { Card, CardContent } from "@/components/ui/card"
import { CreditCard } from "lucide-react"
import type { PaymentMethod } from "@/lib/subscription"

interface PaymentMethodCardProps {
  paymentMethod: PaymentMethod
}

export function PaymentMethodCard({ paymentMethod }: PaymentMethodCardProps) {
  // Get card brand icon
  const getCardBrandIcon = (brand: string) => {
    // In a real app, you would use actual card brand icons
    return <CreditCard className="h-6 w-6 text-blue-500" />
  }

  return (
    <Card className={`${paymentMethod.isDefault ? "border-blue-500" : ""}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {getCardBrandIcon(paymentMethod.brand)}
            <div>
              <h3 className="font-medium text-gray-900 capitalize">{paymentMethod.brand}</h3>
              <p className="text-sm text-gray-500">
                •••• •••• •••• {paymentMethod.last4}
              </p>
              <p className="text-xs text-gray-500">
                Expires {paymentMethod.expMonth}/{paymentMethod.expYear}
              </p>
            </div>
          </div>
          {paymentMethod.isDefault && (
            <span className="\
