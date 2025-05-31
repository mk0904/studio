
'use client';

import type { User, UserRole, UserProfileUpdateData } from '@/types';
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
  updateUser: (userId: string, data: UserProfileUpdateData) => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();

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
        // This case can happen if a user exists in auth.users but not in public.users
        // For example, if profile creation failed after signup or was manually deleted.
        console.warn('User profile not found in public.users table for an authenticated user.');
        setUser(null); 
      }
    } else {
      setUser(null);
    }
    setIsLoading(false);
  };
  
  useEffect(() => {
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
  }, [toast]); // Removed fetchUserAndSetSession from dependency array as it's defined outside and stable

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
        setIsLoading(false);
        throw profileError;
      }
      toast({ title: "Signup Successful", description: "Account created! If email confirmation is enabled in Supabase, please check your email."});
    } else {
        toast({ title: "Signup Issue", description: "User not returned after signup, or email confirmation may be pending.", variant: "destructive" });
    }
    setIsLoading(false); 
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

  const updateUser = async (userId: string, data: UserProfileUpdateData) => {
    setIsLoading(true);
    let authUpdates: any = {};
    if (data.email) authUpdates.email = data.email;
    if (data.newPassword) authUpdates.password = data.newPassword;

    if (Object.keys(authUpdates).length > 0) {
      const { error: authUpdateError } = await supabase.auth.updateUser(authUpdates);
      if (authUpdateError) {
        toast({ title: "Auth Update Failed", description: authUpdateError.message, variant: "destructive" });
        setIsLoading(false);
        throw authUpdateError;
      }
    }

    const profileDataToUpdate: Partial<User> = {};
    if (data.name) profileDataToUpdate.name = data.name;
    if (data.email) profileDataToUpdate.email = data.email; // Keep email in sync with auth
    if (data.e_code !== undefined) profileDataToUpdate.e_code = data.e_code ?? undefined;
    if (data.location !== undefined) profileDataToUpdate.location = data.location ?? undefined;
    
    if (Object.keys(profileDataToUpdate).length > 0) {
        const { error: profileUpdateError } = await supabase
        .from('users')
        .update(profileDataToUpdate)
        .eq('id', userId);

      if (profileUpdateError) {
        toast({ title: "Profile Update Failed", description: profileUpdateError.message, variant: "destructive" });
        setIsLoading(false);
        throw profileUpdateError;
      }
    }
    
    // Re-fetch the user profile to update context
    const { data: updatedUserProfile, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (fetchError) {
      console.error('Error re-fetching user profile:', fetchError);
      toast({ title: "Update Complete", description: "Profile updated, but UI may not reflect all changes immediately.", variant: "default" });
    } else if (updatedUserProfile) {
      setUser(updatedUserProfile as User);
      toast({ title: "Profile Updated", description: "Your profile has been successfully updated." });
    }
    
    setIsLoading(false);
  };


  return (
    <AuthContext.Provider value={{ user, login, signup, logout, updateUser, isLoading }}>
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
