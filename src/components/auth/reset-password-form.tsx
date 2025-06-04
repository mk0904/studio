'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabaseClient';

const formSchema = z.object({
  email: z.string().email({ message: "Enter a valid email address." }),
});

type ResetPasswordFormValues = z.infer<typeof formSchema>;

export function ResetPasswordForm() {
  const { toast } = useToast();

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
    },
  });

  async function onSubmit(values: ResetPasswordFormValues) {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
        redirectTo: `${window.location.origin}/auth/update-password`,
      });

      if (error) throw error;

      toast({
        title: "Password Reset Link Sent",
        description: "Check your email for the link to reset your password.",
      });

    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input placeholder="you@example.com" className="h-11" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full h-11 bg-[#004C8F] hover:bg-[#003972] text-white font-medium rounded-lg inline-flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#004C8F] focus-visible:ring-offset-2 disabled:opacity-50 shadow-sm hover:shadow disabled:hover:shadow-none">
          Send Reset Link
        </Button>
      </form>
    </Form>
  );
} 