
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
import { mockUsers } from '@/lib/mock-data'; // To populate 'reports_to' dropdowns
import { Loader2, Eye, UserPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const signupFormSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  email: z.string().email({ message: 'Invalid email address.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
  confirmPassword: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
  e_code: z.string().min(1, {message: "E-Code is required."}),
  role: z.enum(['BHR', 'ZHR', 'VHR', 'CHR'], { required_error: "Please select a role." }),
  location: z.string().min(1, {message: "Location is required."}),
  reports_to: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"], 
}).refine(data => {
    // If role is CHR, reports_to is not needed.
    // For other roles, reports_to becomes mandatory.
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

  const [zhrUsers, setZhrUsers] = useState<User[]>([]);
  const [vhrUsers, setVhrUsers] = useState<User[]>([]);
  const [chrUsers, setChrUsers] = useState<User[]>([]);
  
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
    setZhrUsers(mockUsers.filter(user => user.role === 'ZHR'));
    setVhrUsers(mockUsers.filter(user => user.role === 'VHR'));
    setChrUsers(mockUsers.filter(user => user.role === 'CHR'));
    // Reset reports_to when role changes to ensure correct validation and options
    form.setValue('reports_to', '');
  }, [selectedRole, form]);

  async function onSubmit(values: SignupFormValues) {
    try {
      // Password handling is mocked; in a real app, hash password before sending.
      await signup(values.name, values.email, values.role as UserRole, values.e_code, values.location, values.reports_to);
      toast({
        title: "Signup Successful",
        description: "Your account has been created. Welcome!",
      });
      // Form will reset or redirect via AuthContext or page navigation
    } catch (error) {
       toast({
        title: "Signup Failed",
        description: (error as Error).message || "An unexpected error occurred.",
        variant: "destructive",
      });
    }
  }

  const renderReportsToField = () => {
    if (!selectedRole || selectedRole === 'CHR') return null;

    let label = "";
    let options: User[] = [];

    if (selectedRole === 'BHR') {
      label = "Select ZHR (Reports to)";
      options = zhrUsers;
    } else if (selectedRole === 'ZHR') {
      label = "Select VHR (Reports to)";
      options = vhrUsers;
    } else if (selectedRole === 'VHR') {
      label = "Select CHR (Reports to)";
      options = chrUsers;
    }

    if (options.length === 0 && selectedRole !== 'CHR') {
        return (
             <FormItem>
                <FormLabel>{label}</FormLabel>
                <FormControl>
                    <Input readOnly value={`No ${selectedRole === 'BHR' ? 'ZHRs' : selectedRole === 'ZHR' ? 'VHRs' : 'CHRs'} available in mock data.`} className="bg-muted"/>
                </FormControl>
                <FormMessage />
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
            <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value || undefined}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder={`Select who this ${selectedRole} reports to`} />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {options.map(user => (
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
                <FormLabel>E-Code</FormLabel>
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
                <FormLabel>Location</FormLabel>
                <FormControl>
                    <Input placeholder="e.g., Delhi" {...field} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
        />
        
        {renderReportsToField()}

        <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white" disabled={isLoading}>
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
