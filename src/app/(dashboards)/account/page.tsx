
'use client';

import React, { useState, useEffect } from 'react';
import { PageTitle } from '@/components/shared/page-title';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/auth-context';
import { EditProfileModal } from '@/components/auth/edit-profile-modal';
import { Loader2, LogOut, Pencil, UserCircle2, Mail, Briefcase, Hash, MapPin, Users } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import type { User } from '@/types';
import { Badge } from '@/components/ui/badge'; // Added import

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
  const { user, logout, isLoading: isAuthLoading } = useAuth();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [manager, setManager] = useState<User | null>(null);
  const [isLoadingManager, setIsLoadingManager] = useState(false);

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

    if (user) {
      fetchManagerDetails();
    }
  }, [user]);

  if (isAuthLoading || !user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase();

  return (
    <>
      <PageTitle title="My Account" description="View and manage your profile details." />
      <div className="mt-8 max-w-3xl mx-auto">
        <Card className="shadow-xl">
          <CardHeader className="pb-4">
            <div className="flex flex-col items-center sm:flex-row sm:items-start gap-6">
              <Avatar className="h-24 w-24 text-3xl">
                <AvatarImage src={`https://placehold.co/150x150.png?text=${initials}`} alt={user.name} data-ai-hint="avatar person" />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="text-center sm:text-left">
                <CardTitle className="text-3xl">{user.name}</CardTitle>
                <CardDescription className="text-md mt-1">{user.email}</CardDescription>
                <Badge variant="secondary" className="mt-2 text-sm">{user.role}</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="divide-y divide-border">
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
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-end">
              <Button variant="outline" onClick={() => setIsEditModalOpen(true)}>
                <Pencil className="mr-2 h-4 w-4" /> Edit Profile
              </Button>
              <Button variant="destructive" onClick={logout}>
                <LogOut className="mr-2 h-4 w-4" /> Logout
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {user && (
        <EditProfileModal
          currentUser={user}
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
        />
      )}
    </>
  );
}
