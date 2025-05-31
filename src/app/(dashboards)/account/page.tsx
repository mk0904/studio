
'use client';

import React, { useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { PageTitle } from '@/components/shared/page-title';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/auth-context';
import type { User, UserProfileUpdateData, UserRole } from '@/types';
import { Loader2, LogOut, Pencil, UserCircle2, Mail, Briefcase, Hash, MapPin, Users, Save, X, Eye } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { Badge } from '@/components/ui/badge';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

interface DetailRowProps {
  icon: React.ElementType;
  label: string;
  value?: string | null;
  isLoading?: boolean;
}

const DetailRow: React.FC<DetailRowProps> = ({ icon: Icon, label, value, isLoading }) => (
  <div className="flex items-start space-x-3 py-3">
    <Icon className="h-5 w-5 text-muted-foreground mt-1" />
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
      ) : (
        <p className="text-base font-medium text-foreground">{value || 'N/A'}</p>
      )}
    </div>
  </div>
);

export default function AccountPage() {
  const { user, logout, updateUser, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [manager, setManager] = useState<User | null>(null);
  const [isLoadingManager, setIsLoadingManager] = useState(false);
  const [potentialManagers, setPotentialManagers] = useState<User[]>([]);
  const [isLoadingPotentialManagers, setIsLoadingPotentialManagers] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const form = useForm<EditProfileFormValues>({
    resolver: zodResolver(editProfileFormSchema),
    defaultValues: {
      name: '',
      email: '',
      e_code: '',
      location: '',
      reports_to: '',
      newPassword: '',
      confirmNewPassword: '',
    },
  });

  useEffect(() => {
    if (user) {
      form.reset({
        name: user.name || '',
        email: user.email || '',
        e_code: user.e_code || '',
        location: user.location || '',
        reports_to: user.reports_to || undefined, // Ensure it's undefined if null for Select
        newPassword: '',
        confirmNewPassword: '',
      });
    }
  }, [user, form, isEditing]); // Reset form when user changes or editing mode toggles


  useEffect(() => {
    const fetchManagerDetails = async () => {
      if (user?.reports_to) {
        setIsLoadingManager(true);
        const { data, error } = await supabase
          .from('users')
          .select('id, name, role')
          .eq('id', user.reports_to)
          .single();
        if (error) {
          console.error("Error fetching manager details:", error);
          setManager(null);
        } else {
          setManager(data as User);
        }
        setIsLoadingManager(false);
      } else {
        setManager(null);
      }
    };

    if (user && !isEditing) { // Fetch only when not editing
      fetchManagerDetails();
    }
  }, [user, isEditing]);

  useEffect(() => {
    const fetchPotentialManagers = async () => {
      if (!user || user.role === 'CHR' || !isEditing) {
        setPotentialManagers([]);
        return;
      }
      setIsLoadingPotentialManagers(true);
      let targetRole: UserRole | null = null;
      if (user.role === 'BHR') targetRole = 'ZHR';
      else if (user.role === 'ZHR') targetRole = 'VHR';
      else if (user.role === 'VHR') targetRole = 'CHR';

      if (targetRole) {
        const { data, error } = await supabase
          .from('users')
          .select('id, name, role')
          .eq('role', targetRole)
          .not('id', 'eq', user.id);

        if (error) {
          toast({ title: "Error", description: `Could not load managers list.`, variant: "destructive" });
          setPotentialManagers([]);
        } else {
          setPotentialManagers(data as User[]);
        }
      } else {
        setPotentialManagers([]);
      }
      setIsLoadingPotentialManagers(false);
    };

    if (isEditing) {
      fetchPotentialManagers();
    }
  }, [user, isEditing, toast]);

  async function onSubmit(values: EditProfileFormValues) {
    if (!user) return;
    const updateData: UserProfileUpdateData = {
      name: values.name,
      email: values.email,
      e_code: values.e_code,
      location: values.location,
      reports_to: values.reports_to === '' || values.reports_to === 'none' ? null : values.reports_to,
    };
    if (values.newPassword) {
      updateData.newPassword = values.newPassword;
    }
    
    try {
      await updateUser(user.id, updateData);
      setIsEditing(false); // Exit editing mode on success
    } catch (error) {
      // Error toast is handled by updateUser in AuthContext
      console.error("Failed to update profile:", error);
    }
  }

  if (isAuthLoading || !user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  const initials = user.name.split(' ').map((n) => n[0]).join('').toUpperCase();

  return (
    <>
      <PageTitle title="My Account" description="View and manage your profile details." />
      <div className="mt-8 max-w-3xl mx-auto">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <Card className="shadow-xl">
              <CardHeader className="pb-4">
                <div className="flex flex-col items-center sm:flex-row sm:items-start gap-6">
                  <Avatar className="h-24 w-24 text-3xl">
                    <AvatarImage src={`https://placehold.co/150x150.png?text=${initials}`} alt={user.name} data-ai-hint="avatar person" />
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <div className="text-center sm:text-left">
                    {isEditing ? (
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem className="mb-2">
                            <FormLabel className="sr-only">Full Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Your Name" {...field} className="text-3xl font-bold h-auto p-0 border-0 shadow-none focus-visible:ring-0" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ) : (
                      <CardTitle className="text-3xl">{user.name}</CardTitle>
                    )}
                    {isEditing ? (
                       <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="sr-only">Email</FormLabel>
                            <FormControl>
                              <Input type="email" placeholder="youremail@example.com" {...field} className="text-md text-muted-foreground h-auto p-0 border-0 shadow-none focus-visible:ring-0" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ) : (
                      <CardDescription className="text-md mt-1">{user.email}</CardDescription>
                    )}
                    <Badge variant="secondary" className="mt-2 text-sm">{user.role}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="divide-y divide-border">
                  {isEditing ? (
                    <>
                      <FormField control={form.control} name="e_code" render={({ field }) => (
                        <FormItem className="py-3">
                          <div className="flex items-center space-x-3">
                            <Hash className="h-5 w-5 text-muted-foreground mt-1 flex-shrink-0" />
                            <div className="flex-grow">
                              <FormLabel className="text-sm text-muted-foreground">Employee Code (E-Code)</FormLabel>
                              <FormControl><Input placeholder="E12345" {...field} value={field.value ?? ''} className="text-base font-medium p-0 border-0 shadow-none focus-visible:ring-0 h-auto mt-0.5" /></FormControl>
                              <FormMessage />
                            </div>
                          </div>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="location" render={({ field }) => (
                        <FormItem className="py-3">
                           <div className="flex items-center space-x-3">
                            <MapPin className="h-5 w-5 text-muted-foreground mt-1 flex-shrink-0" />
                            <div className="flex-grow">
                              <FormLabel className="text-sm text-muted-foreground">Location</FormLabel>
                              <FormControl><Input placeholder="e.g., Delhi" {...field} value={field.value ?? ''} className="text-base font-medium p-0 border-0 shadow-none focus-visible:ring-0 h-auto mt-0.5" /></FormControl>
                              <FormMessage />
                            </div>
                          </div>
                        </FormItem>
                      )} />
                      {user.role !== 'CHR' && (
                        <FormField control={form.control} name="reports_to" render={({ field }) => (
                          <FormItem className="py-3">
                            <div className="flex items-center space-x-3">
                              <Users className="h-5 w-5 text-muted-foreground mt-1 flex-shrink-0" />
                              <div className="flex-grow">
                                <FormLabel className="text-sm text-muted-foreground">Reports To</FormLabel>
                                <Select 
                                  onValueChange={(value) => field.onChange(value === 'none' ? null : value)} 
                                  value={field.value || 'none'}
                                  disabled={isLoadingPotentialManagers}
                                >
                                  <FormControl>
                                    <SelectTrigger className="text-base font-medium p-0 border-0 shadow-none focus-visible:ring-0 h-auto mt-0.5 data-[placeholder]:text-foreground">
                                      <SelectValue placeholder={isLoadingPotentialManagers ? "Loading..." : "Select manager"} />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="none">None (Clear Selection)</SelectItem>
                                    {potentialManagers.map(pm => (
                                      <SelectItem key={pm.id} value={pm.id}>{pm.name} ({pm.role})</SelectItem>
                                    ))}
                                    {!isLoadingPotentialManagers && potentialManagers.length === 0 && user.role !== 'CHR' && (
                                      <SelectItem value="no-managers" disabled>No eligible managers found</SelectItem>
                                    )}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </div>
                            </div>
                          </FormItem>
                        )} />
                      )}
                      <div className="py-3 space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">Change Password (Optional)</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <FormField control={form.control} name="newPassword" render={({ field }) => (
                            <FormItem>
                              <FormLabel>New Password</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Input type={showNewPassword ? "text" : "password"} placeholder="New password" {...field} />
                                  <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2" onClick={() => setShowNewPassword(!showNewPassword)}><Eye className="h-4 w-4" /></Button>
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={form.control} name="confirmNewPassword" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Confirm Password</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Input type={showConfirmPassword ? "text" : "password"} placeholder="Confirm password" {...field} />
                                  <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2" onClick={() => setShowConfirmPassword(!showConfirmPassword)}><Eye className="h-4 w-4" /></Button>
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <DetailRow icon={UserCircle2} label="Full Name" value={user.name} />
                      <DetailRow icon={Mail} label="Email Address" value={user.email} />
                      <DetailRow icon={Briefcase} label="Role" value={user.role} />
                      <DetailRow icon={Hash} label="Employee Code (E-Code)" value={user.e_code} />
                      <DetailRow icon={MapPin} label="Location" value={user.location} />
                      {user.role !== 'CHR' && (
                        <DetailRow
                          icon={Users}
                          label="Reports To"
                          value={manager ? `${manager.name} (${manager.role})` : (user.reports_to ? 'Loading...' : 'N/A')}
                          isLoading={isLoadingManager && !!user.reports_to}
                        />
                      )}
                    </>
                  )}
                </div>
                <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-end">
                  {isEditing ? (
                    <>
                      <Button variant="outline" onClick={() => { setIsEditing(false); form.reset(); /* Reset form on cancel */ }}>
                        <X className="mr-2 h-4 w-4" /> Cancel
                      </Button>
                      <Button type="submit" disabled={isAuthLoading || isLoadingPotentialManagers}>
                        {isAuthLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save Changes
                      </Button>
                    </>
                  ) : (
                    <Button variant="outline" onClick={() => setIsEditing(true)}>
                      <Pencil className="mr-2 h-4 w-4" /> Edit Profile
                    </Button>
                  )}
                  <Button variant="destructive" onClick={logout}>
                    <LogOut className="mr-2 h-4 w-4" /> Logout
                  </Button>
                </div>
              </CardContent>
            </Card>
          </form>
        </Form>
      </div>
    </>
  );
}
