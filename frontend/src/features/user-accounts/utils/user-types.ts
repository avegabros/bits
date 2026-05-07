export interface UserAccount {
  id: number
  firstName: string
  lastName: string
  email: string
  role: string
  status: 'active' | 'inactive'
  createdAt: string
}

export interface PasswordStrength {
  label: string
  color: string
  textColor: string
  width: string
}

export const getPasswordStrength = (pw: string): PasswordStrength => {
  if (!pw) return { label: '', color: '', textColor: '', width: '0%' }
  let score = 0
  if (pw.length >= 8) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  if (score <= 1) return { label: 'Weak', color: 'bg-red-500', textColor: 'text-red-500', width: '25%' }
  if (score === 2) return { label: 'Fair', color: 'bg-yellow-500', textColor: 'text-yellow-500', width: '50%' }
  if (score === 3) return { label: 'Good', color: 'bg-blue-500', textColor: 'text-blue-500', width: '75%' }
  return { label: 'Strong', color: 'bg-green-500', textColor: 'text-green-500', width: '100%' }
}
