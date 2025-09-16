import { RegisterForm } from "@/components/auth/register-form"
import { AuthLayout } from "@/components/layout/auth-layout"

export default function RegisterPage() {
  return (
    <AuthLayout>
      <RegisterForm />
    </AuthLayout>
  )
}
