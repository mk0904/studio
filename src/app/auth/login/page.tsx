
'use client';

import React, { useState } from 'react';
import { LoginForm } from '@/components/auth/login-form';
import { SignupForm } from '@/components/auth/signup-form';
import { Logo } from '@/components/logo';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';

export default function AuthPage() {
  const [activeTab, setActiveTab] = useState('login');

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-b from-blue-50 to-white p-4 animate-fade-in">
      <Card className="w-full max-w-[400px] mx-auto bg-white/80 backdrop-blur-sm border-0 shadow-[0_2px_40px_-12px_rgba(0,0,0,0.15)] rounded-2xl overflow-hidden animate-scale-in">
        <CardHeader className="text-center space-y-2 px-8 pt-8 pb-6">
          <CardTitle className="text-2xl font-semibold text-[#004C8F]">
            {activeTab === 'login' ? 'Welcome back' : 'Create an account'}
          </CardTitle>
          <CardDescription className="text-sm text-gray-600">
            {activeTab === 'login' 
              ? 'Enter your credentials to access your account'
              : 'Fill in your details to get started'}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-8">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="flex w-full h-11 items-center justify-center rounded-full bg-gray-100/70 p-1 mb-8">
              <TabsTrigger 
                value="login" 
                className="flex-1 flex items-center justify-center whitespace-nowrap rounded-full px-6 py-2.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#004C8F] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-[#004C8F] data-[state=active]:text-white data-[state=active]:shadow-sm data-[state=inactive]:text-gray-600 data-[state=inactive]:hover:text-gray-900"
              >
                Login
              </TabsTrigger>
              <TabsTrigger 
                value="signup"
                className="flex-1 flex items-center justify-center whitespace-nowrap rounded-full px-6 py-2.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#004C8F] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-[#004C8F] data-[state=active]:text-white data-[state=active]:shadow-sm data-[state=inactive]:text-gray-600 data-[state=inactive]:hover:text-gray-900"
              >
                Sign Up
              </TabsTrigger>
            </TabsList>
            <TabsContent value="login">
              <LoginForm />
            </TabsContent>
            <TabsContent value="signup">
              <SignupForm />
            </TabsContent>
          </Tabs>
          <div className="mt-8 pb-8 text-center border-t border-gray-100 pt-6">
            {activeTab === 'login' && (
              <p className="text-sm text-gray-600">
                Don&apos;t have an account?{' '}
                <Button 
                  variant="link" 
                  className="p-0 h-auto text-sm font-medium text-[#004C8F] hover:text-[#003972] transition-colors" 
                  onClick={() => setActiveTab('signup')}
                >
                  Sign up
                </Button>
              </p>
            )}
            {activeTab === 'signup' && (
              <p className="text-sm text-gray-600">
                Already have an account?{' '}
                <Button 
                  variant="link" 
                  className="p-0 h-auto text-sm font-medium text-[#004C8F] hover:text-[#003972] transition-colors" 
                  onClick={() => setActiveTab('login')}
                >
                  Login
                </Button>
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}