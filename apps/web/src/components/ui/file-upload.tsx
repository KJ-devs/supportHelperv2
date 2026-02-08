'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Upload, X, FileImage, FileVideo, FileText, File as FileIcon, Loader2 } from 'lucide-react';

export interface FileAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  url?: string;
  file?: File;
  preview?: string;
  uploading?: boolean;
  error?: string;
}

interface FileUploadProps {
  value: FileAttachment[];
  onChange: (files: FileAttachment[]) => void;
  onUpload?: (file: File) => Promise<{ url: string; id: string }>;
  maxFiles?: number;
  maxSize?: number; // in bytes
  accept?: Record<string, string[]>;
  disabled?: boolean;
  className?: string;
}

// Generate a unique ID
function generateId() {
  return `file-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// Format file size
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Get file icon based on type
function getFileIcon(type: string) {
  if (type.startsWith('image/')) return FileImage;
  if (type.startsWith('video/')) return FileVideo;
  if (type.startsWith('text/') || type.includes('document')) return FileText;
  return FileIcon;
}

// File preview component
function FilePreview({
  file,
  onRemove,
  disabled,
}: {
  file: FileAttachment;
  onRemove: () => void;
  disabled?: boolean;
}) {
  const Icon = getFileIcon(file.type);
  const isImage = file.type.startsWith('image/');

  return (
    <div
      className={cn(
        'relative group flex items-center gap-3 p-3 rounded-lg border bg-card',
        file.error && 'border-destructive',
        file.uploading && 'opacity-70'
      )}
    >
      {/* Preview or Icon */}
      <div className="flex-shrink-0 w-12 h-12 rounded-md overflow-hidden bg-muted flex items-center justify-center">
        {isImage && file.preview ? (
          <img src={file.preview} alt={file.name} className="w-full h-full object-cover" />
        ) : (
          <Icon className="h-6 w-6 text-muted-foreground" />
        )}
      </div>

      {/* File info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{file.name}</p>
        <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
        {file.error && <p className="text-xs text-destructive">{file.error}</p>}
      </div>

      {/* Loading indicator or remove button */}
      {file.uploading ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={onRemove}
          disabled={disabled}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Remove file</span>
        </Button>
      )}
    </div>
  );
}

export function FileUpload({
  value = [],
  onChange,
  onUpload,
  maxFiles = 5,
  maxSize = 10 * 1024 * 1024, // 10MB
  accept = {
    'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
    'video/*': ['.mp4', '.webm', '.mov'],
    'application/pdf': ['.pdf'],
    'text/*': ['.txt', '.md', '.json'],
  },
  disabled = false,
  className,
}: FileUploadProps) {
  const [dragActive, setDragActive] = useState(false);

  const handleFiles = useCallback(
    async (acceptedFiles: File[]) => {
      // Check max files limit
      const availableSlots = maxFiles - value.length;
      const filesToAdd = acceptedFiles.slice(0, availableSlots);

      // Create file attachments
      const newAttachments: FileAttachment[] = filesToAdd.map(file => ({
        id: generateId(),
        name: file.name,
        size: file.size,
        type: file.type,
        file,
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
        uploading: !!onUpload,
      }));

      // Add to state immediately
      const updatedFiles = [...value, ...newAttachments];
      onChange(updatedFiles);

      // Upload files if handler provided
      if (onUpload) {
        const uploadPromises = newAttachments.map(async attachment => {
          try {
            const result = await onUpload(attachment.file!);
            return {
              ...attachment,
              id: result.id,
              url: result.url,
              uploading: false,
            };
          } catch (error) {
            return {
              ...attachment,
              uploading: false,
              error: 'Upload failed',
            };
          }
        });

        const uploadedFiles = await Promise.all(uploadPromises);

        // Update with upload results
        onChange([...value, ...uploadedFiles]);
      }
    },
    [value, onChange, onUpload, maxFiles]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleFiles,
    onDragEnter: () => setDragActive(true),
    onDragLeave: () => setDragActive(false),
    accept,
    maxSize,
    maxFiles: maxFiles - value.length,
    disabled: disabled || value.length >= maxFiles,
  });

  const removeFile = useCallback(
    (id: string) => {
      const fileToRemove = value.find(f => f.id === id);
      if (fileToRemove?.preview) {
        URL.revokeObjectURL(fileToRemove.preview);
      }
      onChange(value.filter(f => f.id !== id));
    },
    [value, onChange]
  );

  const isMaxFilesReached = value.length >= maxFiles;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={cn(
          'relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
          isDragActive || dragActive
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-muted-foreground/50',
          (disabled || isMaxFilesReached) && 'opacity-50 cursor-not-allowed'
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-2">
          <Upload
            className={cn(
              'h-10 w-10',
              isDragActive || dragActive ? 'text-primary' : 'text-muted-foreground'
            )}
          />
          <div className="text-sm">
            {isDragActive ? (
              <p className="text-primary font-medium">Drop files here...</p>
            ) : (
              <>
                <p className="font-medium">Drag & drop files here, or click to select</p>
                <p className="text-muted-foreground text-xs mt-1">
                  Up to {maxFiles} files, max {formatFileSize(maxSize)} each
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* File list */}
      {value.length > 0 && (
        <div className="space-y-2">
          {value.map(file => (
            <FilePreview
              key={file.id}
              file={file}
              onRemove={() => removeFile(file.id)}
              disabled={disabled}
            />
          ))}
        </div>
      )}

      {/* File count indicator */}
      {value.length > 0 && (
        <p className="text-xs text-muted-foreground text-right">
          {value.length} / {maxFiles} files
        </p>
      )}
    </div>
  );
}

export type { FileUploadProps };
