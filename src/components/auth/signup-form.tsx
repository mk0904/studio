
'use client';

import React, { useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from '@/contexts/auth-context';
import type { User, UserRole } from '@/types';
// import { mockUsers } from '@/lib/mock-data'; // Will fetch from Supabase later or pass as props if needed for reports_to
import { Eye, EyeOff, Loader2, UserPlus } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabaseClient'; // For fetching users for 'reports_to'

const signupFormSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  email: z.string().email({ message: 'Invalid email address.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
  confirmPassword: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
  e_code: z.string().optional(),
  role: z.enum(['BHR', 'ZHR', 'VHR', 'CHR'], { required_error: "Please select a role." }),
  location: z.string().optional(),
  reports_to: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
}).refine(data => {
    if (data.role === 'CHR') return true;
    return !!data.reports_to;
}, {
    message: "This field is required for the selected role.",
    path: ["reports_to"],
});


type SignupFormValues = z.infer<typeof signupFormSchema>;

export function SignupForm() {
  const { signup, isLoading } = useAuth();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [potentialManagers, setPotentialManagers] = useState<User[]>([]);
  
  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupFormSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      e_code: '',
      role: undefined,
      location: '',
      reports_to: '',
    },
  });

  const selectedRole = form.watch('role');

  useEffect(() => {
    const fetchManagers = async (role: UserRole) => {
      let targetRole: UserRole | null = null;
      if (role === 'BHR') targetRole = 'ZHR';
      else if (role === 'ZHR') targetRole = 'VHR';
      else if (role === 'VHR') targetRole = 'CHR';

      if (targetRole) {
        const { data, error } = await supabase
          .from('users')
          .select('id, name, role')
          .eq('role', targetRole);
        
        if (error) {
          console.error(`Error fetching ${targetRole}s:`, error);
          toast({title: "Error", description: `Could not load ${targetRole} list.`, variant: "destructive"})
          setPotentialManagers([]);
        } else {
          setPotentialManagers(data as User[]);
        }
      } else {
        setPotentialManagers([]);
      }
    };

    if (selectedRole) {
      fetchManagers(selectedRole);
      form.setValue('reports_to', ''); // Reset reports_to when role changes
    }
  }, [selectedRole, form, toast]);

  async function onSubmit(values: SignupFormValues) {
    try {
      await signup(
        values.name, 
        values.email, 
        values.role as UserRole, 
        values.password,
        values.e_code, 
        values.location, 
        values.reports_to
      );
      // toast for success is handled in AuthContext after profile creation
      // form.reset(); // Reset form on successful signup
    } catch (error) {
      // Toast for error is handled in AuthContext
    }
  }

  const renderReportsToField = () => {
    if (!selectedRole || selectedRole === 'CHR') return null;

    let label = "";
    let targetRoleName = "";

    if (selectedRole === 'BHR') { label = "Select ZHR (Reports to)"; targetRoleName = "ZHRs"; }
    else if (selectedRole === 'ZHR') { label = "Select VHR (Reports to)"; targetRoleName = "VHRs"; }
    else if (selectedRole === 'VHR') { label = "Select CHR (Reports to)"; targetRoleName = "CHRs"; }

    if (potentialManagers.length === 0 && selectedRole !== 'CHR') {
        return (
             <FormItem>
                <FormLabel>{label}</FormLabel>
                <FormControl>
                    <Input readOnly value={`No ${targetRoleName} available.`} className="bg-muted"/>
                </FormControl>
                <FormMessage /> {/* Will show required message if reports_to is not filled */}
             </FormItem>
        )
    }

    return (
      <FormField
        control={form.control}
        name="reports_to"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{label}</FormLabel>
            <Select onValueChange={field.onChange} value={field.value || undefined}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder={`Select who this ${selectedRole} reports to`} />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {potentialManagers.map(user => (
                  <SelectItem key={user.id} value={user.id}>{user.name} ({user.role})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
    );
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium text-gray-700">Email</FormLabel>
              <FormControl>
                <Input 
                  placeholder="youremail@hdfclife.com" 
                  className="h-11" 
                  {...field} 
                />
              </FormControl>
              <FormMessage className="text-xs font-medium text-red-500 mt-1.5" />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium text-gray-700">Password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input 
                      type={showPassword ? "text" : "password"} 
                      placeholder="••••••••" 
                      className="h-11 pr-11 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0" 
                      {...field} 
                    />
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      className="absolute right-0 top-0 h-11 w-11 px-3 text-gray-500 hover:text-[#004C8F] transition-all duration-200 hover:scale-110 hover:bg-blue-50/50 rounded-full overflow-hidden group"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeOff className="h-[18px] w-[18px] transform transition-all duration-200 rotate-0 group-hover:rotate-12" />
                      ) : (
                        <Eye className="h-[18px] w-[18px] transform transition-all duration-200 rotate-0 group-hover:-rotate-12" />
                      )}
                    </Button>
                  </div>
                </FormControl>
                <FormMessage className="text-xs font-medium text-red-500" />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium text-gray-700">Confirm Password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input 
                      type={showConfirmPassword ? "text" : "password"} 
                      placeholder="••••••••" 
                      className="h-11 pr-11 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0" 
                      {...field} 
                    />
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      className="absolute right-0 top-0 h-11 w-11 px-3 text-gray-500 hover:text-[#004C8F] transition-all duration-200 hover:scale-110 hover:bg-blue-50/50 rounded-full overflow-hidden group"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-[18px] w-[18px] transform transition-all duration-200 rotate-0 group-hover:rotate-12" />
                      ) : (
                        <Eye className="h-[18px] w-[18px] transform transition-all duration-200 rotate-0 group-hover:-rotate-12" />
                      )}
                    </Button>
                  </div>
                </FormControl>
                <FormMessage className="text-xs font-medium text-red-500" />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium text-gray-700">Full Name</FormLabel>
              <FormControl>
                <Input 
                  placeholder="Enter your full name" 
                  className="h-11" 
                  {...field} 
                />
              </FormControl>
              <FormMessage className="text-xs font-medium text-red-500 mt-1.5" />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="e_code"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium text-gray-700">E-Code</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="E12345" 
                    className="h-11" 
                    {...field} 
                  />
                </FormControl>
                <FormMessage className="text-xs font-medium text-red-500 mt-1.5" />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium text-gray-700">Role</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="rounded-lg border-gray-200">
                    <SelectItem value="BHR" className="focus:bg-blue-50">BHR (Branch HR)</SelectItem>
                    <SelectItem value="ZHR" className="focus:bg-blue-50">ZHR (Zonal HR)</SelectItem>
                    <SelectItem value="VHR" className="focus:bg-blue-50">VHR (Vertical HR)</SelectItem>
                    <SelectItem value="CHR" className="focus:bg-blue-50">CHR (Chief HR)</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage className="text-xs font-medium text-red-500 mt-1.5" />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="location"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium text-gray-700">Location</FormLabel>
              <FormControl>
                <Input 
                  placeholder="e.g., Delhi" 
                  className="h-11" 
                  {...field} 
                />
              </FormControl>
              <FormMessage className="text-xs font-medium text-red-500 mt-1.5" />
            </FormItem>
          )}
        />
        
        {renderReportsToField()}

        <Button 
          type="submit" 
          className="w-full h-11 bg-[#004C8F] hover:bg-[#003972] text-white font-medium rounded-lg inline-flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#004C8F] focus-visible:ring-offset-2 disabled:opacity-50 shadow-sm hover:shadow disabled:hover:shadow-none" 
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="mr-2 h-[18px] w-[18px] animate-spin" />
          ) : (
            <UserPlus className="mr-2 h-[18px] w-[18px]" />
          )}
          Create Account
        </Button>
      </form>
    </Form>
  );
}

