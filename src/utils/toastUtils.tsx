import { toast } from 'sonner';
import { RotateCcw } from 'lucide-react';
import React from 'react';

// Professional toast utilities using default Sonner icons (clean black icons)
export const showSuccessToast = (message: string, description?: string, action?: { label: string; onClick: () => void }) => {
  toast.success(message, {
    description,
    action: action ? {
      label: (
        <div className="flex items-center gap-2">
          <RotateCcw className="w-3 h-3" />
          {action.label}
        </div>
      ),
      onClick: action.onClick
    } : undefined,
    duration: action ? 10000 : 4000, // 10 seconds if action available, 4 seconds otherwise
  });
};

export const showErrorToast = (message: string, description?: string) => {
  toast.error(message, {
    description,
    duration: 6000,
  });
};

export const showWarningToast = (message: string, description?: string) => {
  toast.warning(message, {
    description,
    duration: 5000,
  });
};

export const showInfoToast = (message: string, description?: string) => {
  toast.info(message, {
    description,
    duration: 4000,
  });
};