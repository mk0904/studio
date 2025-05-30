
'use client';

import type { User, UserRole } from '@/types';
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { mockUsers } from '@/lib/mock-data'; // Mock users
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  login: (email: string, password?: string) => Promise<void>; // Password ignored for mock
  signup: (
    name: string, 
    email: string, 
    role: UserRole, 
    e_code?: string, 
    location?: string, 
    reports_to?: string
  ) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// In-memory store for users added during the session via signup
let sessionMockUsers: User[] = [...mockUsers];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();

  useEffect(() => {
    const storedUser = localStorage.getItem('hr-view-user');
    if (storedUser) {
      const parsedUser: User = JSON.parse(storedUser);
      // Ensure this user is also in our sessionMockUsers if they signed up in a previous session
      if (!sessionMockUsers.find(u => u.id === parsedUser.id)) {
        sessionMockUsers.push(parsedUser);
      }
      setUser(parsedUser);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!isLoading && !user && !pathname.startsWith('/auth')) {
      router.push('/auth/login');
    }
  }, [user, isLoading, pathname, router]);

  const navigateToDashboard = (role: UserRole) => {
    switch (role) {
      case 'BHR': router.push('/bhr/dashboard'); break;
      case 'ZHR': router.push('/zhr/dashboard'); break;
      case 'VHR': router.push('/vhr/dashboard'); break;
      case 'CHR': router.push('/chr/dashboard'); break;
      default: router.push('/auth/login'); 
    }
  };

  // Password parameter is present for form compatibility but ignored in mock logic
  const login = async (email: string, password?: string) => {
    setIsLoading(true);
    const foundUser = sessionMockUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
    
    if (foundUser) {
      setUser(foundUser);
      localStorage.setItem('hr-view-user', JSON.stringify(foundUser));
      navigateToDashboard(foundUser.role);
      toast({
        title: "Login Successful",
        description: `Welcome back, ${foundUser.name}!`,
      });
    } else {
      const defaultRole: UserRole = 'BHR'; // Default role for new demo users
      toast({
        title: "Demo Session Initiated",
        description: `User with email '${email}' not found. Starting a demo session as ${defaultRole}. You can also sign up for a specific role.`,
        variant: "default",
      });
      const demoUser: User = { 
        id: `demo-${Date.now()}`, 
        email, 
        name: email.split('@')[0] || 'Demo User', 
        role: defaultRole 
      };
      setUser(demoUser);
      localStorage.setItem('hr-view-user', JSON.stringify(demoUser));
      if (!sessionMockUsers.find(u => u.id === demoUser.id)) {
        sessionMockUsers.push(demoUser);
      }
      navigateToDashboard(defaultRole);
    }
    setIsLoading(false);
  };

  const signup = async (
    name: string, 
    email: string, 
    role: UserRole,
    e_code?: string,
    location?: string,
    reports_to?: string
  ) => {
    setIsLoading(true);
    const existingUser = sessionMockUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existingUser) {
      setIsLoading(false);
      throw new Error("User with this email already exists.");
    }

    const newUser: User = {
      id: `user-${Date.now()}-${Math.random().toString(36).substring(7)}`, // More unique ID
      name,
      email,
      role,
      e_code,
      location,
      reports_to: reports_to || undefined, // Ensure it's undefined if empty string
    };

    sessionMockUsers.push(newUser); 
    setUser(newUser);
    localStorage.setItem('hr-view-user', JSON.stringify(newUser));
    
    navigateToDashboard(newUser.role);
    setIsLoading(false);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('hr-view-user');
    router.push('/auth/login');
  };

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
