import { LoginView } from '@/features/auth/components/LoginView'

export const metadata = {
  title: 'Login - Biometric Integrated Timekeeping System',
  description: 'Login to access the BITS Web Portal for your respective branch and department.',
}

export default function LoginPage() {
  return <LoginView />
}