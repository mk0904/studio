
'use client';

import type { User, UserRole } from '@/types';
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { mockUsers } from '@/lib/mock-data'; // Mock users

interface AuthContextType {
  user: User | null;
  login: (email: string, role: UserRole) => Promise<void>; // Simplified login
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Simulate checking for an existing session
    const storedUser = localStorage.getItem('hr-view-user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!isLoading && !user && !pathname.startsWith('/auth')) {
      router.push('/auth/login');
    }
  }, [user, isLoading, pathname, router]);

  const login = async (email: string, role: UserRole) => {
    setIsLoading(true);
    // Simulate API call & find user
    const foundUser = mockUsers.find(u => u.email.toLowerCase() === email.toLowerCase() && u.role === role);
    
    if (foundUser) {
      setUser(foundUser);
      localStorage.setItem('hr-view-user', JSON.stringify(foundUser));
      // Redirect based on role
      switch (foundUser.role) {
        case 'BHR': router.push('/bhr/dashboard'); break;
        case 'ZHR': router.push('/zhr/dashboard'); break;
        case 'VHR': router.push('/vhr/dashboard'); break;
        case 'CHR': router.push('/chr/dashboard'); break;
        default: router.push('/auth/login');
      }
    } else {
      // Handle login failure (e.g., show a toast)
      console.error("Login failed: User not found or role mismatch");
      // For now, just log, a toast would be better in a real app.
      // To make it work for any email with selected role for demo:
      const demoUser: User = { id: 'demo-user', email, name: email.split('@')[0], role };
      setUser(demoUser);
      localStorage.setItem('hr-view-user', JSON.stringify(demoUser));
      switch (role) {
        case 'BHR': router.push('/bhr/dashboard'); break;
        case 'ZHR': router.push('/zhr/dashboard'); break;
        case 'VHR': router.push('/vhr/dashboard'); break;
        case 'CHR': router.push('/chr/dashboard'); break;
        default: router.push('/auth/login');
      }
    }
    setIsLoading(false);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('hr-view-user');
    router.push('/auth/login');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
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
