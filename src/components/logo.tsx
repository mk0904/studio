
import React from 'react';
import Link from 'next/link';
import { Building } from 'lucide-react'; // Example icon

interface LogoProps {
  className?: string;
}

export function Logo({ className }: LogoProps) {
  return (
    <Link href="/" className={`flex items-center gap-2 text-2xl font-bold text-primary ${className}`}>
      <Building className="h-7 w-7" />
      <span>HDFC Life Visit Management System</span>
    </Link>
  );
}
