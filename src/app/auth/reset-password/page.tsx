'use client';

import React from 'react';
import { Logo } from '@/components/logo';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
// We will create this component next
import { ResetPasswordForm } from '@/components/auth/reset-password-form';

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-b from-blue-50 to-white p-4 animate-fade-in">
      <Card className="w-full max-w-[400px] mx-auto bg-white/80 backdrop-blur-sm border-0 shadow-[0_2px_40px_-12px_rgba(0,0,0,0.15)] rounded-2xl overflow-hidden animate-scale-in">
        <CardHeader className="text-center space-y-2 px-8 pt-8 pb-6">
          <CardTitle className="text-2xl font-semibold text-[#004C8F]">
            Reset Your Password
          </CardTitle>
          <CardDescription className="text-sm text-gray-600">
            Enter your email address to receive a password reset link
          </CardDescription>
        </CardHeader>
        <CardContent className="px-8">
          {/* The ResetPasswordForm component will go here */}
          <ResetPasswordForm />
        </CardContent>
      </Card>
    </div>
  );
} 