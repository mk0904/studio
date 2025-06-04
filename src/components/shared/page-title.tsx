
import React from 'react';

interface PageTitleProps {
  title: string;
  description?: string;
  className?: string;
  action?: React.ReactNode; // Added action prop
}

export function PageTitle({ title, description, className, action }: PageTitleProps) {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 ${className || ''}`}>
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#004C8F]">{title}</h1>
        {description && (
          <p className="text-xs sm:text-sm text-muted-foreground/80 mt-0.5 sm:mt-1">{description}</p>
        )}
        {/* On mobile, show the action below, right-aligned */}
        {action && (
          <div className="flex justify-end mt-2 sm:hidden">
            {action}
          </div>
        )}
      </div>
      {/* On desktop, show the action inline right */}
      {action && (
        <div className="hidden sm:block sm:ml-4 flex-shrink-0">
          {action}
        </div>
      )}
    </div>
  );
}
