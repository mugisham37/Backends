import { ResetPasswordForm } from "@/components/auth/reset-password-form"
import { AuthLayout } from "@/components/layout/auth-layout"

export default function ResetPasswordPage({ searchParams }: { searchParams: { token?: string } }) {
  return (
    <AuthLayout>
      <ResetPasswordForm token={searchParams.token || ""} />
    </AuthLayout>
  )
}
