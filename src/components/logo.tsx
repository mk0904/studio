import React from 'react';
import Link from 'next/link';

interface LogoProps {
  className?: string;
}

export function Logo({ className }: LogoProps) {
  return (
    <Link href="/" className={`flex items-center ${className}`}>
      <div className="grid place-items-center w-10 h-10 rounded bg-[#e31837] text-white font-bold text-xl leading-none">
        H
      </div>
    </Link>
  );
}
