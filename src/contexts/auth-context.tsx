
'use client';

import type { User, UserRole } from '@/types';
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient'; // Import Supabase client
import type { AuthChangeEvent, Session, User as SupabaseAuthUser } from '@supabase/supabase-js';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  login: (email: string, password?: string) => Promise<void>;
  signup: (
    name: string,
    email: string,
    role: UserRole,
    password?: string, 
    e_code?: string,
    location?: string,
    reports_to?: string
  ) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();

  useEffect(() => {
    const fetchUserAndSetSession = async (sessionUser: SupabaseAuthUser | null) => {
      if (sessionUser) {
        const { data: userProfile, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', sessionUser.id)
          .single();

        if (error && error.code !== 'PGRST116') { 
          console.error('Error fetching user profile:', error);
          toast({ title: "Error", description: "Could not fetch user profile.", variant: "destructive" });
          setUser(null);
        } else if (userProfile) {
          setUser(userProfile as User);
        } else {
          console.warn('User profile not found in public.users table for an authenticated user.');
          setUser(null); 
        }
      } else {
        setUser(null);
      }
      setIsLoading(false);
    };
    
    supabase.auth.getSession().then(({ data: { session } }) => {
        fetchUserAndSetSession(session?.user ?? null);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        setIsLoading(true);
        fetchUserAndSetSession(session?.user ?? null);
      }
    );

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [toast]);

  useEffect(() => {
    if (!isLoading && !user && !pathname.startsWith('/auth')) {
      router.push('/auth/login');
    } else if (!isLoading && user && pathname.startsWith('/auth/login')) {
      navigateToDashboard(user.role);
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

  const login = async (email: string, password?: string) => {
    setIsLoading(true);
    if (!password) {
      toast({ title: "Login Error", description: "Password is required.", variant: "destructive" });
      setIsLoading(false);
      return;
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      toast({ title: "Login Failed", description: error.message, variant: "destructive" });
      setIsLoading(false);
      throw error;
    }
    
    if (data.user) {
      // onAuthStateChange will handle fetching profile and setting user state
      // No need to call setIsLoading(false) here, as onAuthStateChange will trigger it
      // navigateToDashboard will also be handled by the useEffect listening to user changes
       toast({ title: "Login Successful", description: `Welcome back!` });
    }
  };

  const signup = async (
    name: string,
    email: string,
    role: UserRole,
    password?: string,
    e_code?: string,
    location?: string,
    reports_to?: string
  ) => {
    setIsLoading(true);
    if (!password) {
        toast({ title: "Signup Error", description: "Password is required.", variant: "destructive" });
        setIsLoading(false);
        throw new Error("Password is required for signup.");
    }

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name, 
        }
      }
    });

    if (authError) {
      toast({ title: "Signup Failed", description: authError.message, variant: "destructive" });
      setIsLoading(false);
      throw authError;
    }

    if (authData.user) {
      const { error: profileError } = await supabase.from('users').insert({
        id: authData.user.id, 
        name,
        email,
        role,
        e_code: e_code || null,
        location: location || null,
        reports_to: reports_to || null,
      });

      if (profileError) {
        let detailedMessage = profileError.message;
        if (profileError.message.includes("violates row-level security policy") && profileError.message.includes("users")) {
            detailedMessage = "Profile creation failed due to RLS. Please ensure 'Enable email confirmations' is turned OFF in your Supabase Auth settings for easier development, or implement server-side profile creation for production. Original error: " + profileError.message;
        }
        toast({ title: "Profile Creation Failed", description: detailedMessage, variant: "destructive" });
        console.error("Error creating user profile:", profileError);
        // Attempt to clean up the auth user if profile creation fails. This might not always be desired.
        // Consider manual cleanup or a different strategy for production.
        // await supabase.auth.deleteUser(authData.user.id); // This requires admin privileges, not suitable for client-side.
        // For now, just log and let the user exist in auth.users.
        setIsLoading(false);
        throw profileError;
      }
      toast({ title: "Signup Successful", description: "Account created! If email confirmation is enabled in Supabase, please check your email."});
      // onAuthStateChange will handle setting user state if auto-signin occurs or after email confirm
      // For now, after successful signup, we might want to redirect to login or a "check your email" page
      // if email confirmation is on. If off, onAuthStateChange should pick up the new user.
    } else {
        toast({ title: "Signup Issue", description: "User not returned after signup, or email confirmation may be pending.", variant: "destructive" });
    }
    setIsLoading(false); // Explicitly set false here
  };

  const logout = async () => {
    setIsLoading(true);
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({ title: "Logout Failed", description: error.message, variant: "destructive" });
    }
    setUser(null); 
    router.push('/auth/login'); 
    setIsLoading(false); 
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
