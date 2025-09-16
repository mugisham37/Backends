import { LoginForm } from "@/components/auth/login-form"
import { AuthLayout } from "@/components/layout/auth-layout"

export default function LoginPage() {
  return (
    <AuthLayout>
      <LoginForm />
    </AuthLayout>
  )
}
