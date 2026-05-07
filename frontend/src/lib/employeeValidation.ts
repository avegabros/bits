import { z } from 'zod';

export const employeeFormSchema = z.object({
  employeeNumber: z.string()
    .min(2, 'Employee ID must be at least 2 characters long.'),
  firstName: z.string()
    .min(1, 'First name is required')
    .trim(),
  lastName: z.string()
    .min(1, 'Last name is required')
    .trim(),
  contactNumber: z.string()
    .min(1, 'Contact number is required')
    .transform(val => val.replace(/\D/g, ''))
    .refine(val => val.length === 11, 'Must be exactly 11 digits'),
  email: z.string()
    .email('A valid email is required')
    .or(z.literal(''))
    .optional(),
  departmentId: z.number({ error: 'Department is required' }),
  branchId: z.number({ error: 'Branch is required' }),
  dateOfBirth: z.string().optional().refine((date) => {
    if (!date) return true;
    return new Date(date).getTime() <= new Date().getTime();
  }, { message: 'Date of Birth cannot be in the future' }),
  hireDate: z.string().optional().refine((date) => {
    if (!date) return true;
    return new Date(date).getTime() <= new Date().getTime();
  }, { message: 'Date Hired cannot be in the future' })
}).passthrough();

export type EmployeeFormInput = z.infer<typeof employeeFormSchema>;

export const validateEmployeeForm = (data: unknown): { data?: EmployeeFormInput; errors: Record<string, string> } => {
  const result = employeeFormSchema.safeParse(data);
  if (result.success) return { data: result.data, errors: {} };
  
  const errors: Record<string, string> = {};
  result.error.issues.forEach(issue => {
    const path = issue.path[0] as string;
    if (!errors[path]) {
      errors[path] = issue.message;
    }
  });
  
  return { errors };
};

// Legacy shim to avoid breaking anything not covered yet
export const validateEmployeeId = (id: string | null | undefined): { isValid: boolean; error?: string } => {
  if (!id || id.trim() === '') {
    return { isValid: false, error: 'Employee ID is required.' };
  }
  
  const trimmedId = id.trim();
  if (trimmedId.length < 2) {
    return { isValid: false, error: 'Employee ID must be at least 2 characters long.' };
  }
  return { isValid: true };
};
