'use client'

import { AuthLayout } from './AuthLayout'
import { LoginForm } from './LoginForm'
import { useLogin } from '../hooks/useLogin'

export function LoginView() {
  const loginState = useLogin()

  return (
    <AuthLayout showLoading={loginState.showLoading}>
      <LoginForm loginState={loginState} />
    </AuthLayout>
  )
}
