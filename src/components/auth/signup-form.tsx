
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
import { Loader2, Eye, UserPlus } from 'lucide-react';
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
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input placeholder="youremail@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                    <div className="relative">
                    <Input 
                        type={showPassword ? "text" : "password"} 
                        placeholder="••••••••" 
                        {...field} 
                    />
                    <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon" 
                        className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                        <Eye className="h-4 w-4" />
                    </Button>
                    </div>
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
            <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Confirm Password</FormLabel>
                <FormControl>
                    <div className="relative">
                    <Input 
                        type={showConfirmPassword ? "text" : "password"} 
                        placeholder="••••••••" 
                        {...field} 
                    />
                    <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon" 
                        className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    >
                        <Eye className="h-4 w-4" />
                    </Button>
                    </div>
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
        </div>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full Name</FormLabel>
              <FormControl>
                <Input placeholder="Your Name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
            control={form.control}
            name="e_code"
            render={({ field }) => (
                <FormItem>
                <FormLabel>E-Code (Optional)</FormLabel>
                <FormControl>
                    <Input placeholder="E12345" {...field} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
            <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Role</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                    <SelectTrigger>
                        <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                    <SelectItem value="BHR">BHR (Branch HR)</SelectItem>
                    <SelectItem value="ZHR">ZHR (Zonal HR)</SelectItem>
                    <SelectItem value="VHR">VHR (Vertical HR)</SelectItem>
                    <SelectItem value="CHR">CHR (Chief HR)</SelectItem>
                    </SelectContent>
                </Select>
                <FormMessage />
                </FormItem>
            )}
            />
        </div>
        <FormField
            control={form.control}
            name="location"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Location (Optional)</FormLabel>
                <FormControl>
                    <Input placeholder="e.g., Delhi" {...field} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
        />
        
        {renderReportsToField()}

        <Button type="submit" className="w-full" variant="default" disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <UserPlus className="mr-2 h-4 w-4" />
          )}
          Create Account
        </Button>
      </form>
    </Form>
  );
}

