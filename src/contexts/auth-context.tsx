
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
    password?: string, // Added password for Supabase signup
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

        if (error && error.code !== 'PGRST116') { // PGRST116: no rows found
          console.error('Error fetching user profile:', error);
          toast({ title: "Error", description: "Could not fetch user profile.", variant: "destructive" });
          setUser(null);
        } else if (userProfile) {
          setUser(userProfile as User);
        } else {
          // This case might happen if a user exists in Supabase auth but not in our public.users table
          // For robust systems, you might want to create the profile here or handle it differently.
          console.warn('User profile not found in public.users table for an authenticated user.');
          setUser(null); // Or set a minimal user object if appropriate
        }
      } else {
        setUser(null);
      }
      setIsLoading(false);
    };
    
    // Check initial session
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
      // If user is logged in and on login page, redirect to their dashboard
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
      toast({ title: "Login Successful", description: `Welcome back!` });
    }
    // setIsLoading(false) will be handled by onAuthStateChange listener
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
          name: name, // You can add non-sensitive initial data here
        }
      }
    });

    if (authError) {
      toast({ title: "Signup Failed", description: authError.message, variant: "destructive" });
      setIsLoading(false);
      throw authError;
    }

    if (authData.user) {
      // Insert user profile into public.users table
      const { error: profileError } = await supabase.from('users').insert({
        id: authData.user.id, // Link to the auth.users table
        name,
        email,
        role,
        e_code: e_code || null,
        location: location || null,
        reports_to: reports_to || null,
      });

      if (profileError) {
        // This is a tricky state. Auth user created, but profile failed.
        // For simplicity, we'll toast and log. In a real app, you might want to clean up the auth user.
        toast({ title: "Profile Creation Failed", description: profileError.message, variant: "destructive" });
        console.error("Error creating user profile:", profileError);
        // Potentially sign out the user again or guide them
        await supabase.auth.signOut();
        setIsLoading(false);
        throw profileError;
      }
      // onAuthStateChange will handle setting user state after profile creation
      // but since signUp doesn't automatically sign in for email confirmation flows,
      // we might want to set user state optimistically or wait for email confirmation.
      // For this app, assuming direct sign-in or test mode where email confirmation is off.
      toast({ title: "Signup Successful", description: "Your account has been created. Welcome!"});
    } else {
        toast({ title: "Signup Issue", description: "User not returned after signup.", variant: "destructive" });
    }
    // setIsLoading(false) will be handled by onAuthStateChange listener
  };

  const logout = async () => {
    setIsLoading(true);
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({ title: "Logout Failed", description: error.message, variant: "destructive" });
    } else {
      setUser(null); // Clear user state immediately
      router.push('/auth/login'); // Redirect to login
    }
    setIsLoading(false); // Explicitly set here as onAuthStateChange might not fire immediately or as expected on forced nav
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
