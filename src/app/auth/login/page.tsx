
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-background to-muted/30 p-4 animate-fade-in">
      <div className="mb-8">
        <Logo className="text-3xl" />
      </div>
      <Card className="w-full max-w-md shadow-strong rounded-lg animate-scale-in">
        <CardHeader className="text-center pt-8 pb-4">
          <CardTitle className="text-3xl font-bold text-primary">Welcome</CardTitle>
          <CardDescription className="text-muted-foreground mt-1">
            {activeTab === 'login' ? "Enter your credentials to access your account" : "Create a new account to get started"}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-8 pt-2">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-muted p-1 rounded-md">
              <TabsTrigger 
                value="login" 
                className="data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-medium rounded-sm py-2 text-sm"
              >
                Login
              </TabsTrigger>
              <TabsTrigger 
                value="signup"
                className="data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-medium rounded-sm py-2 text-sm"
              >
                Sign Up
              </TabsTrigger>
            </TabsList>
            <TabsContent value="login" className="pt-6">
              <LoginForm />
            </TabsContent>
            <TabsContent value="signup" className="pt-6">
              <SignupForm />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      {activeTab === 'login' && (
        <p className="mt-8 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Button variant="link" className="p-0 h-auto font-semibold text-primary" onClick={() => setActiveTab('signup')}>
            Sign up
          </Button>
        </p>
      )}
       {activeTab === 'signup' && (
        <p className="mt-8 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Button variant="link" className="p-0 h-auto font-semibold text-primary" onClick={() => setActiveTab('login')}>
            Login
          </Button>
        </p>
      )}
      <p className="mt-4 text-center text-xs text-muted-foreground/80">
        &copy; {new Date().getFullYear()} HR View. All rights reserved.
      </p>
    </div>
  );
}

    