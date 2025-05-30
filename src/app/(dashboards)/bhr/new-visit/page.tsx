
'use client';

import React, { useEffect, useState }from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { PageTitle } from '@/components/shared/page-title';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/auth-context';
import type { Branch } from '@/types';
import { getVisibleBranchesForBHR, mockVisits } from '@/lib/mock-data'; // Assuming you have this in mock-data

const visitFormSchema = z.object({
  branch_id: z.string().min(1, "Please select a branch."),
  visit_date: z.date({
    required_error: "A visit date is required.",
  }),
  notes: z.string().min(10, "Notes must be at least 10 characters long.").max(1000, "Notes cannot exceed 1000 characters."),
});

type VisitFormValues = z.infer<typeof visitFormSchema>;

export default function NewVisitPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [assignedBranches, setAssignedBranches] = useState<Branch[]>([]);
  
  const form = useForm<VisitFormValues>({
    resolver: zodResolver(visitFormSchema),
    defaultValues: {
      notes: "",
    },
  });

  useEffect(() => {
    if (user && user.role === 'BHR') {
      setAssignedBranches(getVisibleBranchesForBHR(user.id));
    }
  }, [user]);

  async function onSubmit(data: VisitFormValues) {
    if (!user) {
      toast({ title: "Error", description: "User not authenticated.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000)); 
    
    const selectedBranch = assignedBranches.find(b => b.id === data.branch_id);

    // Add to mockVisits for demo purposes
    mockVisits.push({
        id: `visit-${mockVisits.length + 1}`,
        bhr_id: user.id,
        bhr_name: user.name,
        branch_id: data.branch_id,
        branch_name: selectedBranch?.name || 'Unknown Branch',
        visit_date: format(data.visit_date, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
        notes: data.notes,
    });

    toast({
      title: "Visit Logged Successfully!",
      description: `Visit to ${selectedBranch?.name} on ${format(data.visit_date, "PPP")} has been recorded.`,
    });
    form.reset();
    setIsLoading(false);
  }

  if (!user) return <PageTitle title="Loading..." />;


  return (
    <div className="space-y-8">
      <PageTitle title="Log New Branch Visit" description="Record the details of your recent branch visit." />
      <Card className="max-w-2xl mx-auto shadow-xl">
        <CardHeader>
          <CardTitle>Visit Details</CardTitle>
          <CardDescription>Fill in the form below to log your visit.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="branch_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Branch</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a branch" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {assignedBranches.map(branch => (
                          <SelectItem key={branch.id} value={branch.id}>{branch.name} - {branch.location}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="visit_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Visit Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) =>
                            date > new Date() || date < new Date("2000-01-01")
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Visit Summary / Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter key observations, discussions, and action items from your visit..."
                        className="resize-y min-h-[120px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isLoading}>
                 {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit Visit Report
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
