
'use client';

import React, { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label'; // Keep if used elsewhere, but FormLabel is preferred in Form
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Form,
  FormControl,
  FormDescription,
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
import { CalendarIcon, Loader2, Save, Send, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { PageTitle } from '@/components/shared/page-title';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/auth-context';
import type { Branch, Visit, VisitStatus } from '@/types';
import { supabase } from '@/lib/supabaseClient';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const qualitativeQuestionSchema = z.enum(['yes', 'no'], {
  errorMap: () => ({ message: 'Please select Yes or No.' }),
}).optional();

const visitFormSchema = z.object({
  branch_id: z.string().min(1, "Please select a branch."),
  visit_date: z.date({
    required_error: "A visit date is required.",
  }),
  hr_connect_conducted: z.boolean().default(false).optional(),
  hr_connect_employees_invited: z.coerce.number().min(0, "Cannot be negative").optional(),
  hr_connect_participants: z.coerce.number().min(0, "Cannot be negative").optional(),
  manning_percentage: z.coerce.number().min(0, "Must be >= 0").max(100, "Must be <= 100").optional(),
  attrition_percentage: z.coerce.number().min(0).max(100).optional(),
  non_vendor_percentage: z.coerce.number().min(0).max(100).optional(),
  er_percentage: z.coerce.number().min(0).max(100).optional(),
  cwt_cases: z.coerce.number().min(0, "Cannot be negative").optional(),
  performance_level: z.string().optional(),
  new_employees_total: z.coerce.number().min(0).optional(),
  new_employees_covered: z.coerce.number().min(0).optional(),
  star_employees_total: z.coerce.number().min(0).optional(),
  star_employees_covered: z.coerce.number().min(0).optional(),
  qual_aligned_conduct: qualitativeQuestionSchema,
  qual_safe_secure: qualitativeQuestionSchema,
  qual_motivated: qualitativeQuestionSchema,
  qual_abusive_language: qualitativeQuestionSchema,
  qual_comfortable_escalate: qualitativeQuestionSchema,
  qual_inclusive_culture: qualitativeQuestionSchema,
  additional_remarks: z.string().max(1000, "Remarks cannot exceed 1000 characters.").optional(),
  status: z.custom<VisitStatus>().default('draft'), // Default to draft
}).refine(data => !data.new_employees_total || !data.new_employees_covered || data.new_employees_covered <= data.new_employees_total, {
  message: "Covered new employees cannot exceed total new employees.",
  path: ["new_employees_covered"],
}).refine(data => !data.star_employees_total || !data.star_employees_covered || data.star_employees_covered <= data.star_employees_total, {
  message: "Covered STAR employees cannot exceed total STAR employees.",
  path: ["star_employees_covered"],
}).refine(data => {
  if (data.hr_connect_conducted && (data.hr_connect_employees_invited || 0) > 0 && (data.hr_connect_participants || 0) > (data.hr_connect_employees_invited || 0)) {
    return false;
  }
  return true;
}, {
  message: "Total participants cannot exceed total employees invited.",
  path: ["hr_connect_participants"],
}).refine(data => {
  if (data.hr_connect_conducted && (data.hr_connect_participants || 0) > 0 && (data.hr_connect_employees_invited || 0) === 0) {
     return false;
  }
  return true;
}, {
  message: "Total employees invited must be greater than 0 if there are participants.",
  path: ["hr_connect_employees_invited"],
});

type VisitFormValues = z.infer<typeof visitFormSchema>;

const performanceLevels = ["Excellent", "Good", "Average", "Needs Improvement", "Poor"];

interface QualitativeQuestion {
  name: keyof VisitFormValues; // Ensure names match the schema
  label: string;
}

const qualitativeQuestions: QualitativeQuestion[] = [
  { name: "qual_aligned_conduct", label: "Do leaders conduct business/work that is aligned with company's code of conduct?" },
  { name: "qual_safe_secure", label: "Do employees feel safe & secure at their workplace?" },
  { name: "qual_motivated", label: "Do employees feel motivated at workplace?" },
  { name: "qual_abusive_language", label: "Do leaders use abusive and rude language in meetings or on the floor or in person?" },
  { name: "qual_comfortable_escalate", label: "Do employees feel comfortable to escalate or raise malpractice or ethically wrong things?" },
  { name: "qual_inclusive_culture", label: "Do employees feel workplace culture is inclusive with respect to caste, gender & religion?" },
];


export default function NewVisitPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingBranches, setIsLoadingBranches] = useState(true);
  const [assignedBranches, setAssignedBranches] = useState<Branch[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedBranchInfo, setSelectedBranchInfo] = useState<{ category: string, code: string } | null>(null);
  const [coveragePercentage, setCoveragePercentage] = useState(0);
  
  const form = useForm<VisitFormValues>({
    resolver: zodResolver(visitFormSchema),
    defaultValues: {
      hr_connect_conducted: false,
      hr_connect_employees_invited: 0,
      hr_connect_participants: 0,
      additional_remarks: "",
      manning_percentage: 0,
      attrition_percentage: 0,
      non_vendor_percentage: 0,
      er_percentage: 0,
      cwt_cases: 0,
      new_employees_total: 0,
      new_employees_covered: 0,
      star_employees_total: 0,
      star_employees_covered: 0,
      status: 'draft',
    },
  });

  const watchedBranchId = form.watch('branch_id');
  const hrConnectConducted = form.watch('hr_connect_conducted');
  const employeesInvited = form.watch('hr_connect_employees_invited');
  const participants = form.watch('hr_connect_participants');

  useEffect(() => {
    const fetchAssignedBranches = async () => {
      if (user && user.role === 'BHR') {
        setIsLoadingBranches(true);
        setFetchError(null);
        console.log("NewVisitPage: Fetching assignments for BHR:", user.id);
        const { data: assignments, error: assignmentsError } = await supabase
          .from('assignments')
          .select('branch_id')
          .eq('bhr_id', user.id);

        if (assignmentsError) {
          console.error("NewVisitPage: Error fetching assignments:", assignmentsError);
          toast({ title: "Error", description: `Failed to fetch assignments: ${assignmentsError.message}`, variant: "destructive" });
          setFetchError(`Failed to fetch assignments: ${assignmentsError.message}`);
          setAssignedBranches([]);
          setIsLoadingBranches(false);
          return;
        }

        if (!assignments || assignments.length === 0) {
          console.log("NewVisitPage: No assignments found for BHR:", user.id);
          setAssignedBranches([]);
          setIsLoadingBranches(false);
          return;
        }

        const branchIds = assignments.map(a => a.branch_id);
        console.log("NewVisitPage: Found branch IDs from assignments:", branchIds);

        const { data: branches, error: branchesError } = await supabase
          .from('branches')
          .select('*')
          .in('id', branchIds);

        if (branchesError) {
          console.error("NewVisitPage: Error fetching branches:", branchesError);
          toast({ title: "Error", description: `Failed to fetch branches: ${branchesError.message}`, variant: "destructive" });
          setFetchError(`Failed to fetch branches: ${branchesError.message}`);
          setAssignedBranches([]);
        } else {
          console.log("NewVisitPage: Fetched branches:", branches);
          setAssignedBranches(branches as Branch[] || []);
        }
        setIsLoadingBranches(false);
      } else {
        setIsLoadingBranches(false);
        setAssignedBranches([]);
      }
    };

    fetchAssignedBranches();
  }, [user, toast]);

  useEffect(() => {
    if (watchedBranchId) {
      const branch = assignedBranches.find(b => b.id === watchedBranchId);
      if (branch) {
        setSelectedBranchInfo({ category: branch.category, code: branch.code });
      } else {
        setSelectedBranchInfo(null);
      }
    } else {
      setSelectedBranchInfo(null);
    }
  }, [watchedBranchId, assignedBranches]);

  useEffect(() => {
    if (hrConnectConducted && employeesInvited && employeesInvited > 0 && participants !== undefined) {
      setCoveragePercentage(Math.round((participants / employeesInvited) * 100));
    } else {
      setCoveragePercentage(0);
    }
  }, [hrConnectConducted, employeesInvited, participants]);

  async function handleFormSubmit(data: VisitFormValues, statusToSet: VisitStatus) {
    if (!user) {
      toast({ title: "Error", description: "User not authenticated.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    
    const selectedBranch = assignedBranches.find(b => b.id === data.branch_id);
    if (!selectedBranch) {
        toast({ title: "Error", description: "Selected branch not found.", variant: "destructive" });
        setIsSubmitting(false);
        return;
    }

    const visitDataToInsert = {
      bhr_id: user.id,
      branch_id: data.branch_id,
      visit_date: format(data.visit_date, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"), // Ensure ISO 8601 format
      status: statusToSet,
      hr_connect_conducted: data.hr_connect_conducted,
      hr_connect_employees_invited: data.hr_connect_conducted ? data.hr_connect_employees_invited : null,
      hr_connect_participants: data.hr_connect_conducted ? data.hr_connect_participants : null,
      manning_percentage: data.manning_percentage,
      attrition_percentage: data.attrition_percentage,
      non_vendor_percentage: data.non_vendor_percentage,
      er_percentage: data.er_percentage,
      cwt_cases: data.cwt_cases,
      performance_level: data.performance_level,
      new_employees_total: data.new_employees_total,
      new_employees_covered: data.new_employees_covered,
      star_employees_total: data.star_employees_total,
      star_employees_covered: data.star_employees_covered,
      qual_aligned_conduct: data.qual_aligned_conduct,
      qual_safe_secure: data.qual_safe_secure,
      qual_motivated: data.qual_motivated,
      qual_abusive_language: data.qual_abusive_language,
      qual_comfortable_escalate: data.qual_comfortable_escalate,
      qual_inclusive_culture: data.qual_inclusive_culture,
      additional_remarks: data.additional_remarks,
      // branch_name, bhr_name, branch_category, branch_code are not directly inserted
      // as they can be derived or joined. If your RLS needs them, you might need to use a function call.
      // Or, your table might not store these denormalized fields.
    };

    console.log("NewVisitPage: Submitting visit data:", visitDataToInsert);

    const { error } = await supabase.from('visits').insert(visitDataToInsert);

    if (error) {
      console.error("NewVisitPage: Error inserting visit:", error);
      toast({ title: "Error", description: `Failed to submit visit: ${error.message}`, variant: "destructive" });
    } else {
      toast({
        title: statusToSet === 'draft' ? "Visit Saved as Draft!" : "Visit Submitted Successfully!",
        description: `${statusToSet === 'draft' ? 'Draft for' : 'Visit to'} ${selectedBranch?.name} on ${format(data.visit_date, "PPP")} has been recorded.`,
      });
      if (statusToSet !== 'draft') { // Only reset form if not saving as draft
        form.reset();
        setSelectedBranchInfo(null); 
        setCoveragePercentage(0);
      }
    }
    setIsSubmitting(false);
  }

  const onSubmit = (data: VisitFormValues) => handleFormSubmit(data, 'submitted');
  const onSaveDraft = () => form.handleSubmit(data => handleFormSubmit(data, 'draft'))();


  if (!user) return <PageTitle title="Loading user..." />;


  return (
    <div className="space-y-8 pb-12">
      <PageTitle title="Log New Branch Visit" description="Record the details of your recent branch visit." />
      
      {fetchError && (
         <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Branches</AlertTitle>
          <AlertDescription>
            {fetchError} Please ensure you are assigned to branches or try again later.
          </AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-4xl mx-auto">
          
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="branch_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Branch</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isLoadingBranches || assignedBranches.length === 0}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={isLoadingBranches ? "Loading branches..." : (assignedBranches.length === 0 ? "No branches assigned" : "Select a branch")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {assignedBranches.map(branch => (
                            <SelectItem key={branch.id} value={branch.id}>{branch.name} - {branch.location}</SelectItem>
                          ))}
                           {assignedBranches.length === 0 && !isLoadingBranches && <SelectItem value="no-branch" disabled>No branches assigned to you</SelectItem>}
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
                              {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) => date > new Date() || date < new Date("2000-01-01")}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormItem>
                  <FormLabel>Branch Category</FormLabel>
                  <Input readOnly value={selectedBranchInfo?.category || "Select a branch to set category"} className="bg-muted" />
                </FormItem>
                <FormItem>
                  <FormLabel>Branch Code</FormLabel>
                  <Input readOnly value={selectedBranchInfo?.code || "Select a branch to set code"} className="bg-muted" />
                </FormItem>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>HR Connect Session</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="hr_connect_conducted"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow-sm">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>HR Connect Session Conducted</FormLabel>
                      <FormDescription>
                        Check if an HR connect session was conducted during the visit.
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
              {hrConnectConducted && (
                <div className="space-y-4 pt-4 border-t mt-4">
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                    <FormField
                      control={form.control}
                      name="hr_connect_employees_invited"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Total Employees Invited</FormLabel>
                          <FormControl><Input type="number" placeholder="0" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="hr_connect_participants"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Total Participants</FormLabel>
                          <FormControl><Input type="number" placeholder="0" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                     <FormItem>
                        <FormLabel>Coverage Percentage</FormLabel>
                        <Input readOnly value={`${coveragePercentage}%`} className="bg-muted font-semibold" />
                      </FormItem>
                   </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-lg">
            <CardHeader><CardTitle>Branch Metrics</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {(['manning_percentage', 'attrition_percentage', 'non_vendor_percentage', 'er_percentage'] as const).map(metric => (
                <FormField
                  key={metric}
                  control={form.control}
                  name={metric}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{metric.split('_').map(s => s.charAt(0).toUpperCase() + s.substring(1)).join(' ')} (%)</FormLabel>
                      <FormControl><Input type="number" placeholder="0" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
               <FormField
                control={form.control}
                name="cwt_cases"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>No. of CWT Cases</FormLabel>
                    <FormControl><Input type="number" placeholder="0" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10))} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="performance_level"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Performance</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select performance level" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {performanceLevels.map(level => <SelectItem key={level} value={level}>{level}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
          
          <Card className="shadow-lg">
            <CardHeader><CardTitle>Employee Coverage</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="font-medium mb-2 text-muted-foreground">New Employees (0-6 months)</h4>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="new_employees_total"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Total</FormLabel>
                        <FormControl><Input type="number" placeholder="0" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10))} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="new_employees_covered"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Covered</FormLabel>
                        <FormControl><Input type="number" placeholder="0" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10))} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
              <div>
                <h4 className="font-medium mb-2 text-muted-foreground">STAR Employees</h4>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="star_employees_total"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Total</FormLabel>
                        <FormControl><Input type="number" placeholder="0" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10))}/></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="star_employees_covered"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Covered</FormLabel>
                        <FormControl><Input type="number" placeholder="0" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10))}/></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg">
            <CardHeader><CardTitle>Qualitative Assessment</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {qualitativeQuestions.map(q => (
                <FormField
                  key={q.name}
                  control={form.control}
                  name={q.name}
                  render={({ field }) => (
                    <FormItem className="space-y-2 p-3 border rounded-md shadow-sm">
                      <FormLabel className="text-sm">{q.label}</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          value={field.value || ""} // Ensure value is not undefined for RadioGroup
                          className="flex space-x-4"
                        >
                          <FormItem className="flex items-center space-x-2">
                            <FormControl><RadioGroupItem value="yes" /></FormControl>
                            <FormLabel className="font-normal">Yes</FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-2">
                            <FormControl><RadioGroupItem value="no" /></FormControl>
                            <FormLabel className="font-normal">No</FormLabel>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
            </CardContent>
          </Card>

          <Card className="shadow-lg">
            <CardHeader><CardTitle>Additional Remarks</CardTitle></CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="additional_remarks"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="sr-only">Additional Remarks</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter any additional remarks (optional, max 1000 characters)"
                        className="resize-y min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>Maximum 1000 characters.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
          
          <div className="flex flex-col sm:flex-row justify-end gap-4 pt-4">
            <Button type="button" variant="outline" onClick={onSaveDraft} disabled={isSubmitting || isLoadingBranches} className="w-full sm:w-auto">
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save as Draft
            </Button>
            <Button type="submit" className="w-full sm:w-auto" disabled={isSubmitting || isLoadingBranches || assignedBranches.length === 0}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Submit Visit
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

    