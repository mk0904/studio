
import React from 'react';

interface PageTitleProps {
  title: string;
  description?: string;
  className?: string;
}

export function PageTitle({ title, description, className }: PageTitleProps) {
  return (
    <div className={className}>
      <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#004C8F]">{title}</h1>
      {description && (
        <p className="text-xs sm:text-sm text-muted-foreground/80 mt-0.5 sm:mt-1">{description}</p>
      )}
    </div>
  );
}
