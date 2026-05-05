import React, { useState, useRef, useEffect } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { useProfilePicture } from '../hooks/useProfilePicture'
import { Upload, X, Trash2, Check } from 'lucide-react'

interface ProfilePictureUploadProps {
  currentUrl?: string | null
  initials?: string
  onUpload: (file: File) => Promise<void>
  onDelete: () => Promise<void>
  readonly?: boolean
}

export function ProfilePictureUpload({ currentUrl, initials, onUpload, onDelete, readonly = false }: ProfilePictureUploadProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { isUploading, error, handleUpload, handleDelete } = useProfilePicture({
    onUpload: async (file) => {
      await onUpload(file)
      // Clear preview after successful upload (parent component should update currentUrl)
      setPreviewUrl(null)
      setSelectedFile(null)
    },
    onDelete: async () => {
      await onDelete()
    }
  })

  // Cleanup object URL to avoid memory leaks
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setSelectedFile(file)
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
  }

  const triggerFileInput = () => {
    if (isUploading || readonly) return
    fileInputRef.current?.click()
  }

  const cancelUpload = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }
    setPreviewUrl(null)
    setSelectedFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const confirmUpload = async () => {
    if (!selectedFile) return
    await handleUpload(selectedFile)
  }

  const displayUrl = previewUrl || currentUrl

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative group">
        <Avatar 
          src={displayUrl} 
          initials={initials} 
          size="xl" 
          className="ring-4 ring-white shadow-lg"
        />
        
        {/* Hover overlay for changing picture */}
        {!previewUrl && !readonly && (
          <div 
            onClick={triggerFileInput}
            className="absolute inset-0 bg-black/50 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer disabled:cursor-not-allowed"
          >
            <Upload className="w-6 h-6 text-white mb-1" />
            <span className="text-white text-xs font-medium">Change</span>
          </div>
        )}
      </div>

      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept="image/jpeg,image/png,image/webp" 
        className="hidden" 
      />

      {error && (
        <p className="text-red-500 text-sm max-w-xs text-center sm:text-left">{error}</p>
      )}

      {/* Action buttons */}
      {!readonly && (
        <div className="flex flex-wrap gap-2 justify-center">
          {previewUrl ? (
            <>
              <button 
                onClick={confirmUpload}
                disabled={isUploading}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {isUploading ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-1"></span>
                ) : (
                  <Check className="w-4 h-4" />
                )}
                Save
              </button>
              <button 
                onClick={cancelUpload}
                disabled={isUploading}
                className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            </>
          ) : (
            <>
              <button 
                onClick={triggerFileInput}
                disabled={isUploading}
                className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 shadow-sm disabled:opacity-50"
              >
                Upload Photo
              </button>
              
              {currentUrl && (
                <button 
                  onClick={handleDelete}
                  disabled={isUploading}
                  className="flex items-center gap-1 px-3 py-1.5 text-red-600 bg-red-50 text-sm font-medium rounded-md hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50"
                >
                  {isUploading ? (
                    <span className="w-4 h-4 border-2 border-red-600/30 border-t-red-600 rounded-full animate-spin mr-1"></span>
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  Remove
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
