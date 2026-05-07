// ── Settings Feature Types ──────────────────────────────────

export interface UserData {
  firstName: string
  lastName: string
  email: string
  role: string
  contactNumber: string
  branch: string
  department: string
  position: string
}

export interface PasswordForm {
  current: string
  new: string
  confirm: string
}

export interface PasswordStrength {
  label: string
  color: string
  width: string
}
