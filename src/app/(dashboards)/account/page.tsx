
'use client';

import React, { useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { PageTitle } from '@/components/shared/page-title';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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

const DetailRow: React.FC<DetailRowProps> = ({ icon: Icon, label, value, isLoading }: DetailRowProps) => {
  return (
    <div className="flex items-center py-3 px-4 mx-2 rounded-md transition-colors hover:bg-muted/40">
      <Icon className="h-4 w-4 text-muted-foreground/70 flex-shrink-0" />
      <div className="flex flex-1 items-center justify-between ml-4 min-w-0">
        <div className="text-sm font-medium text-foreground/90">{label}</div>
        <div className="text-sm text-muted-foreground truncate ml-4">
          {isLoading ? (
            <div className="flex items-center space-x-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Loading...</span>
            </div>
          ) : (
            value || 'N/A'
          )}
        </div>
      </div>
    </div>
  );
};

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
      <div className="min-h-screen flex justify-center bg-gradient-to-br from-slate-50 via-white to-slate-50/80">
        <div className="w-full max-w-6xl py-8 px-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  const initials = user.name.split(' ').map((n) => n[0]).join('').toUpperCase();

  return (
    <div className="min-h-screen mb-20 flex justify-center bg-gradient-to-br from-slate-50 via-white to-slate-50/80">
      <div className="w-full max-w-6xl py-6 sm:py-8 px-3 sm:px-4">
        <div className="mb-8">
          <PageTitle 
            title="My Account" 
            description="View and manage your account settings"
          />
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <Card className="border-0 bg-gradient-to-br from-white via-slate-50/50 to-slate-100/50 shadow-lg hover:shadow-xl transition-all duration-300 max-w-3xl mx-auto">
              <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-4">
                <div className="flex flex-col sm:flex-row items-center sm:items-center gap-4 sm:gap-6">
                  <Avatar className="h-16 w-16 sm:h-24 sm:w-24 rounded-xl border-2 border-white/50 shadow-xl bg-gradient-to-br from-[#004C8F] to-[#0066CC]">
                    <AvatarFallback className="text-white text-xl sm:text-3xl font-medium">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-2 sm:space-y-3 text-center sm:text-left w-full">
                    <div>
                      <CardTitle className="text-xl sm:text-3xl font-semibold mb-0.5 sm:mb-1 text-slate-800">{user.name}</CardTitle>
                      <CardDescription className="text-sm sm:text-base text-slate-600">{user.email}</CardDescription>
                    </div>
                    <div className="flex flex-wrap justify-center sm:justify-start gap-1.5 sm:gap-2">
                      <Badge 
                        variant="secondary" 
                        className="px-2 sm:px-3 py-0.5 sm:py-1 text-xs font-medium bg-[#004C8F]/10 text-[#004C8F] hover:bg-[#004C8F]/20 transition-colors"
                      >
                        {user.role}
                      </Badge>
                      <Badge 
                        variant="secondary" 
                        className="px-2 sm:px-3 py-0.5 sm:py-1 text-xs font-medium bg-[#004C8F]/10 text-[#004C8F] hover:bg-[#004C8F]/20 transition-colors"
                      >
                        E-Code: {user.e_code}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0 space-y-4">

                {isEditing ? (
                  <>
                    <div className="space-y-4 px-6 py-4">
                      <FormField control={form.control} name="e_code" render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center py-2.5 px-4 rounded-md transition-colors hover:bg-slate-50/80">
                            <Hash className="h-4 w-4 text-muted-foreground/70 flex-shrink-0" />
                            <div className="flex flex-1 items-center justify-between ml-3 min-w-0">
                              <FormLabel className="text-sm font-medium text-foreground/90">Employee Code</FormLabel>
                              <div className="flex-shrink-0 ml-4 w-[180px] sm:w-[280px]">
                                <FormControl>
                                  <Input 
                                    placeholder="E12345" 
                                    {...field} 
                                    value={field.value ?? ''} 
                                    className="text-sm text-muted-foreground w-full h-8 sm:h-10 bg-white/50 border border-slate-200 shadow-sm hover:border-slate-300 focus-visible:ring-1 focus-visible:ring-primary/30 transition-colors" 
                                  />
                                </FormControl>
                              </div>
                            </div>
                          </div>
                          <FormMessage className="text-xs px-4 mt-1 text-red-500" />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="location" render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center py-2.5 px-4 rounded-md transition-colors hover:bg-slate-50/80">
                            <MapPin className="h-4 w-4 text-muted-foreground/70 flex-shrink-0" />
                            <div className="flex flex-1 items-center justify-between ml-3 min-w-0">
                              <FormLabel className="text-sm font-medium text-foreground/90">Location</FormLabel>
                              <div className="flex-shrink-0 ml-4 w-[180px] sm:w-[280px]">
                                <FormControl>
                                  <Input 
                                    placeholder="e.g., Delhi" 
                                    {...field} 
                                    value={field.value ?? ''} 
                                    className="text-sm text-muted-foreground w-full h-8 sm:h-10 bg-white/50 border border-slate-200 shadow-sm hover:border-slate-300 focus-visible:ring-1 focus-visible:ring-primary/30 transition-colors" 
                                  />
                                </FormControl>
                              </div>
                            </div>
                          </div>
                          <FormMessage className="text-xs px-4 mt-1 text-red-500" />
                        </FormItem>
                      )} />
                    </div>
                    {user.role !== 'CHR' && (
                      <FormField control={form.control} name="reports_to" render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center py-3 px-4 rounded-md mx-6 mb-4 transition-colors hover:bg-slate-50/80">
                            <Users className="h-4 w-4 text-muted-foreground/70 flex-shrink-0" />
                            <div className="flex flex-1 items-center justify-between ml-4 min-w-0">
                              <FormLabel className="text-sm font-medium text-foreground/90">Reports To</FormLabel>
                              <div className="flex-shrink-0 ml-4 w-[180px] sm:w-[280px]">
                                <Select 
                                  onValueChange={(value) => field.onChange(value === 'none' ? null : value)} 
                                  value={field.value || 'none'}
                                  disabled={isLoadingPotentialManagers}
                                >
                                  <FormControl>
                                    <SelectTrigger className="text-sm text-muted-foreground w-full h-8 sm:h-10 bg-white/50 border border-slate-200 shadow-sm hover:border-slate-300 focus-visible:ring-1 focus-visible:ring-primary/30 transition-colors data-[placeholder]:text-muted-foreground">
                                      <SelectValue placeholder={isLoadingPotentialManagers ? "Loading..." : "Select manager"} />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent className="w-[180px] sm:w-[280px] max-h-[240px] overflow-y-auto" side="bottom" position="popper" sideOffset={4}>
                                    <SelectItem value="none" className="text-sm">None (Clear Selection)</SelectItem>
                                    {potentialManagers.map(pm => (
                                      <SelectItem key={pm.id} value={pm.id} className="text-sm">{pm.name} ({pm.role})</SelectItem>
                                    ))}
                                    {!isLoadingPotentialManagers && potentialManagers.length === 0 && user.role !== 'CHR' && (
                                      <SelectItem value="no-managers" disabled className="text-sm">No eligible managers found</SelectItem>
                                    )}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </div>
                          <FormMessage className="text-xs px-3 mt-1 text-red-500" />
                        </FormItem>
                      )} />
                    )}
                    <div className="space-y-4 px-6 py-4">
                      <p className="text-sm font-medium text-foreground/90 px-4 mb-2">Change Password (Optional)</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <FormField control={form.control} name="newPassword" render={({ field }) => (
                          <FormItem>
                            <div className="py-2.5 px-4 rounded-md transition-colors hover:bg-slate-50/80">
                              <FormLabel className="text-sm font-medium text-foreground/90 mb-2 block">New Password</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Input 
                                    type={showNewPassword ? "text" : "password"} 
                                    placeholder="New password" 
                                    {...field} 
                                    className="text-sm h-8 sm:h-10 w-full bg-white/50 border border-slate-200 shadow-sm hover:border-slate-300 focus-visible:ring-1 focus-visible:ring-primary/30 transition-colors pr-10"
                                  />
                                  <Button 
                                    type="button" 
                                    variant="ghost" 
                                    size="icon" 
                                    className="absolute right-1.5 top-1/2 h-7 w-7 -translate-y-1/2 hover:bg-slate-100/80 transition-colors" 
                                    onClick={() => setShowNewPassword(!showNewPassword)}
                                  >
                                    <Eye className="h-4 w-4 text-muted-foreground/70" />
                                  </Button>
                                </div>
                              </FormControl>
                              <FormMessage className="text-xs mt-1.5 text-red-500" />
                            </div>
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="confirmNewPassword" render={({ field }) => (
                          <FormItem>
                            <div className="py-2.5 px-4 rounded-md transition-colors hover:bg-slate-50/80">
                              <FormLabel className="text-sm font-medium text-foreground/90 mb-2 block">Confirm Password</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Input 
                                    type={showConfirmPassword ? "text" : "password"} 
                                    placeholder="Confirm password" 
                                    {...field} 
                                    className="text-sm h-8 sm:h-10 w-full bg-white/50 border border-slate-200 shadow-sm hover:border-slate-300 focus-visible:ring-1 focus-visible:ring-primary/30 transition-colors pr-10"
                                  />
                                  <Button 
                                    type="button" 
                                    variant="ghost" 
                                    size="icon" 
                                    className="absolute right-1.5 top-1/2 h-7 w-7 -translate-y-1/2 hover:bg-slate-100/80 transition-colors" 
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                  >
                                    <Eye className="h-4 w-4 text-muted-foreground/70" />
                                  </Button>
                                </div>
                              </FormControl>
                              <FormMessage className="text-xs mt-1.5 text-red-500" />
                            </div>
                          </FormItem>
                        )} />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
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
                    </div>
                  </>
                )}
                <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-4 px-6 py-4 border-t border-slate-200/80 bg-slate-50/50">
                  {isEditing ? (
                    <>
                      <Button 
                        variant="outline" 
                        onClick={() => { setIsEditing(false); form.reset(); }}
                        className="w-full sm:w-auto h-9 text-sm font-medium border-slate-200 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200 transition-colors"
                      >
                        <X className="mr-2 h-4 w-4" />
                        Cancel
                      </Button>
                      <Button 
                        type="submit" 
                        disabled={isAuthLoading || isLoadingPotentialManagers}
                        className="w-full sm:w-auto h-9 text-sm font-medium bg-[#004C8F] hover:bg-[#004C8F]/90 text-white shadow-md hover:shadow-lg transform hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 ease-in-out disabled:opacity-70 disabled:hover:scale-100 disabled:cursor-not-allowed"
                      >
                        {isAuthLoading || isLoadingPotentialManagers ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="mr-2 h-4 w-4" />
                            Save Changes
                          </>
                        )}
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsEditing(true)}
                      className="w-full sm:w-auto h-9 text-sm font-medium border-slate-200 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200 transition-colors"
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit Profile
                    </Button>
                  )}
                  <Button 
                    variant="ghost" 
                    onClick={logout}
                    className="w-full sm:w-auto h-9 text-sm font-medium text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors border border-red-100"
                  >
                    <LogOut className="mr-2 h-4 w-4" /> Logout
                  </Button>
                </div>
              </CardContent>
            </Card>
          </form>
        </Form>
      </div>
    </div>
  );
}
