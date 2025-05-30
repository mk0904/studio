
'use client';

import type { User, UserRole } from '@/types';
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { mockUsers } from '@/lib/mock-data'; // Mock users
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  login: (email: string, role: UserRole) => Promise<void>;
  signup: (name: string, email: string, role: UserRole) => Promise<void>;
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
      default: router.push('/auth/login'); // Should not happen
    }
  };

  const login = async (email: string, role: UserRole) => {
    setIsLoading(true);
    const foundUser = sessionMockUsers.find(u => u.email.toLowerCase() === email.toLowerCase() && u.role === role);
    
    if (foundUser) {
      setUser(foundUser);
      localStorage.setItem('hr-view-user', JSON.stringify(foundUser));
      navigateToDashboard(foundUser.role);
    } else {
      toast({
        title: "Demo Session",
        description: `User '${email}' with role '${role}' not found. Starting a demo session.`,
        variant: "default",
      });
      const demoUser: User = { id: `demo-${Date.now()}`, email, name: email.split('@')[0] || 'Demo User', role };
      setUser(demoUser);
      localStorage.setItem('hr-view-user', JSON.stringify(demoUser));
      // Add demo user to sessionMockUsers so they can "log out and log back in" during the session
      if (!sessionMockUsers.find(u => u.id === demoUser.id)) {
        sessionMockUsers.push(demoUser);
      }
      navigateToDashboard(role);
    }
    setIsLoading(false);
  };

  const signup = async (name: string, email: string, role: UserRole) => {
    setIsLoading(true);
    const existingUser = sessionMockUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existingUser) {
      setIsLoading(false);
      throw new Error("User with this email already exists.");
    }

    const newUser: User = {
      id: `user-${Date.now()}`, // Simple unique ID for mock
      name,
      email,
      role,
    };

    sessionMockUsers.push(newUser); // Add to our in-session mock users
    setUser(newUser);
    localStorage.setItem('hr-view-user', JSON.stringify(newUser));
    
    // toast is handled by the form for success/failure
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
