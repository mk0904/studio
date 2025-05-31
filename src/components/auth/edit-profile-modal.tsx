
'use client';

import React, { useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
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
import type { User, UserProfileUpdateData, UserRole } from '@/types';
import { Loader2, Save, Eye } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';

const editProfileFormSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  email: z.string().email({ message: 'Invalid email address.' }),
  e_code: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  reports_to: z.string().optional().nullable(),
  newPassword: z.string().optional(),
  confirmNewPassword: z.string().optional(),
}).refine(data => {
  if (data.newPassword && data.newPassword.length < 6) {
    return false;
  }
  return true;
}, {
  message: 'New password must be at least 6 characters.',
  path: ['newPassword'],
}).refine(data => {
    if (data.newPassword && !data.confirmNewPassword) return false;
    return true;
}, {
    message: 'Please confirm your new password.',
    path: ['confirmNewPassword'],
})
.refine(data => data.newPassword === data.confirmNewPassword, {
  message: "Passwords don't match",
  path: ['confirmNewPassword'],
});

type EditProfileFormValues = z.infer<typeof editProfileFormSchema>;

interface EditProfileModalProps {
  currentUser: User;
  isOpen: boolean;
  onClose: () => void;
}

export function EditProfileModal({ currentUser, isOpen, onClose }: EditProfileModalProps) {
  const { updateUser, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [potentialManagers, setPotentialManagers] = useState<User[]>([]);
  const [isLoadingManagers, setIsLoadingManagers] = useState(false);

  const form = useForm<EditProfileFormValues>({
    resolver: zodResolver(editProfileFormSchema),
    defaultValues: {
      name: currentUser.name || '',
      email: currentUser.email || '',
      e_code: currentUser.e_code || '',
      location: currentUser.location || '',
      reports_to: currentUser.reports_to || '',
      newPassword: '',
      confirmNewPassword: '',
    },
  });

  useEffect(() => {
    const fetchPotentialManagers = async () => {
      if (!currentUser || currentUser.role === 'CHR' || !isOpen) {
        setPotentialManagers([]);
        return;
      }
      setIsLoadingManagers(true);
      let targetRole: UserRole | null = null;
      if (currentUser.role === 'BHR') targetRole = 'ZHR';
      else if (currentUser.role === 'ZHR') targetRole = 'VHR';
      else if (currentUser.role === 'VHR') targetRole = 'CHR';

      if (targetRole) {
        const { data, error } = await supabase
          .from('users')
          .select('id, name, role')
          .eq('role', targetRole)
          .not('id', 'eq', currentUser.id); // Prevent self-reporting

        if (error) {
          toast({ title: "Error", description: `Could not load managers list for ${targetRole}.`, variant: "destructive" });
          setPotentialManagers([]);
        } else {
          setPotentialManagers(data as User[]);
        }
      } else {
        setPotentialManagers([]);
      }
      setIsLoadingManagers(false);
    };

    fetchPotentialManagers();
  }, [currentUser, isOpen, toast]);

  useEffect(() => {
    if (currentUser && isOpen) {
      form.reset({
        name: currentUser.name || '',
        email: currentUser.email || '',
        e_code: currentUser.e_code || '',
        location: currentUser.location || '',
        reports_to: currentUser.reports_to || '',
        newPassword: '',
        confirmNewPassword: '',
      });
    }
  }, [currentUser, isOpen, form]);

  async function onSubmit(values: EditProfileFormValues) {
    const updateData: UserProfileUpdateData = {
      name: values.name,
      email: values.email,
      e_code: values.e_code,
      location: values.location,
      reports_to: values.reports_to === '' ? null : values.reports_to, // Send null if empty string
    };
    if (values.newPassword) {
      updateData.newPassword = values.newPassword;
    }
    
    try {
      await updateUser(currentUser.id, updateData);
      onClose();
    } catch (error) {
      console.error("Failed to update profile:", error);
    }
  }

  if (!currentUser) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
          <DialogDescription>
            Make changes to your profile here. Click save when you&apos;re done.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl><Input placeholder="Your Name" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl><Input type="email" placeholder="youremail@example.com" {...field} /></FormControl>
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
                    <FormControl><Input placeholder="E12345" {...field} value={field.value ?? ''} /></FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Location</FormLabel>
                    <FormControl><Input placeholder="e.g., Delhi" {...field} value={field.value ?? ''} /></FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
            </div>

            {currentUser.role !== 'CHR' && (
              <FormField
                control={form.control}
                name="reports_to"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reports To</FormLabel>
                    <Select 
                      onValueChange={(value) => field.onChange(value === 'none' ? null : value)} 
                      value={field.value || 'none'}
                      disabled={isLoadingManagers}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={isLoadingManagers ? "Loading managers..." : "Select manager"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">None (Clear Selection)</SelectItem>
                        {potentialManagers.map(manager => (
                          <SelectItem key={manager.id} value={manager.id}>{manager.name} ({manager.role})</SelectItem>
                        ))}
                        {!isLoadingManagers && potentialManagers.length === 0 && currentUser.role !== 'CHR' && (
                            <SelectItem value="no-managers" disabled>No eligible managers found</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Change Password (Optional)</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                    control={form.control}
                    name="newPassword"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>New Password</FormLabel>
                        <FormControl>
                           <div className="relative">
                            <Input 
                                type={showNewPassword ? "text" : "password"} 
                                placeholder="Leave blank to keep current" 
                                {...field} 
                            />
                            <Button 
                                type="button" 
                                variant="ghost" 
                                size="icon" 
                                className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                onClick={() => setShowNewPassword(!showNewPassword)}
                                aria-label={showNewPassword ? "Hide new password" : "Show new password"}
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
                    name="confirmNewPassword"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Confirm New Password</FormLabel>
                        <FormControl>
                            <div className="relative">
                            <Input 
                                type={showConfirmPassword ? "text" : "password"} 
                                placeholder="Confirm new password" 
                                {...field} 
                            />
                            <Button 
                                type="button" 
                                variant="ghost" 
                                size="icon" 
                                className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
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
            </div>
            <DialogFooter className="pt-4">
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={isAuthLoading || isLoadingManagers}>
                {(isAuthLoading || isLoadingManagers) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
