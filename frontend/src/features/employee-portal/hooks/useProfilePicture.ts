import { useState } from 'react'

interface UseProfilePictureProps {
  initialUrl?: string | null
  onUpload: (file: File) => Promise<void>
  onDelete: () => Promise<void>
}

export function useProfilePicture({ initialUrl, onUpload, onDelete }: UseProfilePictureProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleUpload = async (file: File) => {
    setIsUploading(true)
    setError(null)

    // Basic client-side validation
    const validTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!validTypes.includes(file.type)) {
      setError('Invalid file type. Please upload a JPEG, PNG, or WebP image.')
      setIsUploading(false)
      return false
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('File is too large. Maximum size is 5MB.')
      setIsUploading(false)
      return false
    }

    try {
      await onUpload(file)
      return true
    } catch (err: any) {
      setError(err.message || 'Failed to upload profile picture.')
      return false
    } finally {
      setIsUploading(false)
    }
  }

  const handleDelete = async () => {
    setIsUploading(true)
    setError(null)
    try {
      await onDelete()
      return true
    } catch (err: any) {
      setError(err.message || 'Failed to delete profile picture.')
      return false
    } finally {
      setIsUploading(false)
    }
  }

  return {
    isUploading,
    error,
    handleUpload,
    handleDelete,
  }
}
