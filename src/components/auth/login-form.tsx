'use client';

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
import { useAuth } from '@/contexts/auth-context';
import { Eye, EyeOff, Loader2, LogIn } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import React from 'react';

const formSchema = z.object({
  email: z.string().email({ message: 'Invalid email address.' }),
  password: z.string().min(1, { message: 'Password is required.' }), // Password is now required
});

export function LoginForm() {
  const { login, isLoading } = useAuth();
  const { toast } = useToast(); // toast is initialized but not used here, as AuthContext handles toasts
  const [showPassword, setShowPassword] = React.useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      await login(values.email, values.password);
      // successful login redirect is handled by AuthContext via onAuthStateChange and useEffect
    } catch (error) {
      // Error toast is handled by the login function in AuthContext
    }
  }

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
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between">
                <FormLabel className="text-sm font-medium text-gray-700">Password</FormLabel>
              </div>
              <FormControl>
                <div className="relative">
                  <Input 
                    type={showPassword ? "text" : "password"} 
                    placeholder="••••••••" 
                    className="h-11" 
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
              <div className="flex justify-end mt-1">
                <Link href="/auth/reset-password" className="text-sm font-medium text-[#004C8F] hover:text-[#003972] transition-colors">
                  Forgot password?
                </Link>
              </div>
              <FormMessage className="text-xs font-medium text-red-500 mt-1.5" />
            </FormItem>
          )}
        />
        <Button 
          type="submit" 
          className="w-full h-11 bg-[#004C8F] hover:bg-[#003972] text-white font-medium rounded-lg inline-flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#004C8F] focus-visible:ring-offset-2 disabled:opacity-50 shadow-sm hover:shadow disabled:hover:shadow-none" 
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="mr-2 h-[18px] w-[18px] animate-spin" />
          ) : (
            <LogIn className="mr-2 h-[18px] w-[18px]" />
          )}
          Login
        </Button>
      </form>
    </Form>
  );
}

