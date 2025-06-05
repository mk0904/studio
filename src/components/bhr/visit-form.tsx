'use client';

import React, { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
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
import { CalendarIcon, Loader2, Save, Send } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Branch, VisitStatus } from '@/types'; // Assuming VisitFormValues is defined here or inline

const qualitativeQuestionSchema = z.enum(['yes', 'no'], {
  errorMap: () => ({ message: 'Please select Yes or No.' }),
}).optional();

export const visitFormSchema = z.object({
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
  status: z.custom<VisitStatus>().default('draft'),
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
  if (data.hr_connect_conducted && (data.hr_connect_participants || 0) > 0 && (data.hr_connect_employees_invited === undefined || data.hr_connect_employees_invited === 0)) {
     return false;
  }
  return true;
}, {
  message: "Total employees invited must be greater than 0 if there are participants.",
  path: ["hr_connect_employees_invited"],
});

export type VisitFormValues = z.infer<typeof visitFormSchema>;

const performanceLevels = ["Excellent", "Good", "Average", "Needs Improvement", "Poor"];

interface QualitativeQuestion {
  name: keyof VisitFormValues;
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

interface VisitFormProps {
  initialData?: Partial<VisitFormValues>;
  onSubmitForm: (data: VisitFormValues, statusToSet: VisitStatus) => Promise<void>;
  isSubmitting: boolean; // Changed from isLoading to isSubmitting for clarity
  assignedBranches: Branch[];
  isLoadingBranches: boolean;
  onFormReset?: () => void; // Callback to reset parent page state if needed
  submitButtonText?: string;
  draftButtonText?: string;
  isViewMode?: boolean; // New prop to indicate view mode
}

export function VisitForm({
  initialData,
  onSubmitForm,
  isSubmitting,
  assignedBranches,
  isLoadingBranches,
  onFormReset,
  submitButtonText = "Submit Visit",
  draftButtonText = "Save as Draft",
  isViewMode = false
}: VisitFormProps) {
  const [selectedBranchInfo, setSelectedBranchInfo] = useState<{ category: string, code: string, name: string } | null>(null);
  const [coveragePercentage, setCoveragePercentage] = useState(0);

  const form = useForm<VisitFormValues>({
    resolver: zodResolver(visitFormSchema),
    defaultValues: initialData ? 
      {
        ...initialData,
        visit_date: initialData.visit_date ? (typeof initialData.visit_date === 'string' ? parseISO(initialData.visit_date) : initialData.visit_date) : new Date(),
      } : 
      {
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
        visit_date: new Date(),
      },
  });

  const watchedBranchId = form.watch('branch_id');
  const hrConnectConducted = form.watch('hr_connect_conducted');
  const employeesInvited = form.watch('hr_connect_employees_invited');
  const participants = form.watch('hr_connect_participants');

  useEffect(() => {
    // Effect to reset form and set initial branch data when initialData or assignedBranches change
    if (initialData) {
      const dataToReset = {
        ...initialData,
        visit_date: initialData.visit_date ? (typeof initialData.visit_date === 'string' ? parseISO(initialData.visit_date) : initialData.visit_date) : new Date(),
      };
      form.reset(dataToReset);

      // Directly set selectedBranchInfo if initialData has branch_id and branches are loaded
      if (initialData.branch_id && assignedBranches.length > 0) {
        const branch = assignedBranches.find(b => b.id === initialData.branch_id);
        if (branch) {
          setSelectedBranchInfo({ category: branch.category, code: branch.code, name: branch.name });
        } else {
           console.warn("Branch from initialData not found in assignedBranches upon initial load:", initialData.branch_id);
           setSelectedBranchInfo(null);
        }
      } else if (!initialData.branch_id) {
          setSelectedBranchInfo(null);
      }

    } else { // If initialData becomes null, reset form to default
      form.reset({
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
          visit_date: new Date(),
          branch_id: '',
          performance_level: undefined,
        });
      setSelectedBranchInfo(null);
    }
  }, [initialData, assignedBranches]); // Removed 'form' dependency

  useEffect(() => {
    // Effect to update selectedBranchInfo when watchedBranchId or assignedBranches change (for manual select changes)
    // This effect should not run on initial load if initialData is present and handled by the effect above.
    if (!initialData && watchedBranchId && assignedBranches.length > 0) { // Only run if no initialData
      const branch = assignedBranches.find(b => b.id === watchedBranchId);
      if (branch) {
        setSelectedBranchInfo({ category: branch.category, code: branch.code, name: branch.name });
      } else {
        console.warn("Watched branch ID not found in assigned branches:", watchedBranchId);
        setSelectedBranchInfo(null);
      }
    } else if (!initialData && !watchedBranchId) { // Only clear if no initialData
       setSelectedBranchInfo(null);
    } else if (!initialData && watchedBranchId && assignedBranches.length === 0) { // Only run if no initialData
       setSelectedBranchInfo(null); // Or a loading indicator state
    }
  }, [watchedBranchId, assignedBranches, initialData]); // Added initialData dependency

  useEffect(() => {
    if (hrConnectConducted && employeesInvited && employeesInvited > 0 && participants !== undefined) {
      setCoveragePercentage(Math.round((participants / employeesInvited) * 100));
    } else {
      setCoveragePercentage(0);
    }
  }, [hrConnectConducted, employeesInvited, participants]);

  const handleInternalSubmit = (statusToSet: VisitStatus) => async (data: VisitFormValues) => {
    await onSubmitForm(data, statusToSet);
    if (statusToSet !== 'draft' && !initialData) { // Only reset fully if it's a new form submission, not an edit
        form.reset({ // Reset to default initial values for a new form
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
            visit_date: new Date(),
            branch_id: '', // Clear selected branch
            performance_level: undefined,
          });
        setSelectedBranchInfo(null);
        setCoveragePercentage(0);
        if (onFormReset) onFormReset();
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={isViewMode ? (e) => e.preventDefault() : form.handleSubmit(handleInternalSubmit('submitted'))} className="space-y-8 pb-8">
        <Card className="shadow-md hover:shadow-lg border border-slate-200/50 hover:border-slate-300/50 transition-all duration-200 bg-white/80 backdrop-blur-sm [&_input]:border-slate-200 [&_input]:hover:border-slate-300 [&_input]:bg-white/80 [&_input]:h-10 [&_input:not(:focus)]:ring-0 [&_input:not(:focus)]:ring-offset-0 [&_input:focus]:!ring-2 [&_input:focus]:!ring-[#004C8F]/20 [&_input:focus]:!ring-offset-2">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold text-[#004C8F]">Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 p-6 border-t border-slate-100/70">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="branch_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-muted-foreground">Branch</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ''} disabled={isLoadingBranches || assignedBranches.length === 0 || isViewMode}>
                      <FormControl>
                        <SelectTrigger className="border border-slate-200 hover:border-slate-300 bg-white/80 h-10 [&:not(:focus)]:ring-0 [&:not(:focus)]:ring-offset-0 [&:focus]:!ring-2 [&:focus]:!ring-[#004C8F]/20 [&:focus]:!ring-offset-2 transition-all duration-200">
                          <SelectValue placeholder={isLoadingBranches ? "Loading branches..." : (assignedBranches.length === 0 ? "No branches assigned" : "Select a branch")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {assignedBranches.map(branch => (
                          <SelectItem key={branch.id} value={branch.id}>{branch.name} - {branch.location}</SelectItem>
                        ))}
                        {assignedBranches.length === 0 && !isLoadingBranches && <SelectItem value="no-branch-placeholder" disabled>No branches assigned to you</SelectItem>}
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-sm font-medium text-destructive mt-1" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="visit_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel className="text-xs text-muted-foreground">Visit Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full justify-start text-left font-normal border border-slate-200 hover:border-slate-300 bg-white/80 h-10 transition-all duration-200",
                              !field.value && "text-muted-foreground"
                            )}
                            disabled={isViewMode}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value ? format(field.value, "PPP") : <span className="text-muted-foreground">Pick a date</span>}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => date > new Date() || date < new Date("2000-01-01")} // Disable future dates
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage className="text-sm font-medium text-destructive mt-1" />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormItem>
                <FormLabel className="text-xs text-muted-foreground">Branch Category</FormLabel>
                <Input readOnly value={selectedBranchInfo?.category || "Select a branch"} className="bg-slate-50/50 border border-slate-200 h-10" />
              </FormItem>
              <FormItem>
                <FormLabel className="text-xs text-muted-foreground">Branch Code</FormLabel>
                <Input readOnly value={selectedBranchInfo?.code || "Select a branch"} className="bg-slate-50/50 border border-slate-200 h-10" />
              </FormItem>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md hover:shadow-lg border border-slate-200/50 hover:border-slate-300/50 transition-all duration-200 bg-white/80 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold text-[#004C8F]">HR Connect Session</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 p-6 border-t border-slate-100/70">
            <FormField
              control={form.control}
              name="hr_connect_conducted"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-lg border border-slate-200 hover:border-slate-300 p-4 bg-white/80 transition-all duration-200">
                  <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} className="border-slate-300 data-[state=checked]:bg-[#004C8F] data-[state=checked]:border-[#004C8F]" disabled={isViewMode} /></FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel className="text-base font-medium text-slate-800">HR Connect Session Conducted</FormLabel>
                    <FormDescription className="text-sm text-muted-foreground">Check if session was conducted.</FormDescription>
                  </div>
                </FormItem>
              )}
            />
            {hrConnectConducted && (
              <div className="space-y-4 pt-4 border-t border-slate-100/70 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                  <FormField
                    control={form.control}
                    name="hr_connect_employees_invited"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground">Total Employees Invited</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="0"
                            className="placeholder:text-slate-400" disabled={isViewMode}
                            value={field.value || ''}
                            onChange={e => field.onChange(e.target.value === '' ? undefined : parseInt(e.target.value, 10) || 0)} 
                          />
                        </FormControl>
                        <FormMessage className="text-sm font-medium text-destructive mt-1" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="hr_connect_participants"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground">Total Participants</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="0"
                            className="placeholder:text-slate-400" disabled={isViewMode}
                            value={field.value || ''}
                            onChange={e => field.onChange(e.target.value === '' ? undefined : parseInt(e.target.value, 10) || 0)} 
                          />
                        </FormControl>
                        <FormMessage className="text-sm font-medium text-destructive mt-1" />
                      </FormItem>
                    )}
                  />
                  <FormItem>
                    <FormLabel className="text-xs text-muted-foreground">Coverage Percentage</FormLabel>
                    <Input readOnly value={`${coveragePercentage}%`} className="bg-slate-50/50 border border-slate-200 h-10 font-semibold text-[#004C8F]" />
                  </FormItem>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-md hover:shadow-lg border border-slate-200/50 hover:border-slate-300/50 transition-all duration-200 bg-white/80 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-base sm:text-lg font-semibold text-[#004C8F]">Branch Metrics</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6 border-t border-slate-100/70">
            {(['manning_percentage', 'attrition_percentage', 'non_vendor_percentage', 'er_percentage'] as const).map(metric => (
              <FormField
                key={metric}
                control={form.control}
                name={metric}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-muted-foreground">{metric.split('_').map(s => s.charAt(0).toUpperCase() + s.substring(1)).join(' ')} (%)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="0"
                        className="placeholder:text-slate-400" disabled={isViewMode}
                        value={field.value || ''}
                        onChange={e => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage className="text-sm font-medium text-destructive mt-1" />
                  </FormItem>
                )}
              />
            ))}
            <FormField
              control={form.control}
              name="cwt_cases"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-muted-foreground">No. of CWT Cases</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="0"
                      className="placeholder:text-slate-400" disabled={isViewMode}
                      value={field.value || ''}
                      onChange={e => field.onChange(e.target.value === '' ? undefined : parseInt(e.target.value, 10) || 0)} 
                    />
                  </FormControl>
                  <FormMessage className="text-sm font-medium text-destructive mt-1" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="performance_level"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-muted-foreground">Performance</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ''}>
                    <FormControl>
                      <SelectTrigger className="border border-slate-200 hover:border-slate-300 bg-white/80 h-10 [&:not(:focus)]:ring-0 [&:not(:focus)]:ring-offset-0 [&:focus]:!ring-2 [&:focus]:!ring-[#004C8F]/20 [&:focus]:!ring-offset-2 transition-all duration-200" disabled={isViewMode || isLoadingBranches || assignedBranches.length === 0}>
                        <SelectValue placeholder="Select performance level" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {performanceLevels.map(level => <SelectItem key={level} value={level}>{level}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-sm font-medium text-destructive mt-1" />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card className="shadow-md hover:shadow-lg border border-slate-200/50 hover:border-slate-300/50 transition-all duration-200 bg-white/80 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-base sm:text-lg font-semibold text-[#004C8F]">Employee Coverage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 p-6 border-t border-slate-100/70">
            <div>
              <h4 className="font-medium mb-2 text-slate-700 text-base">New Employees (0-6 months)</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="new_employees_total"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Total</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="0"
                          className="placeholder:text-slate-400" disabled={isViewMode}
                          value={field.value || ''}
                          onChange={e => field.onChange(e.target.value === '' ? undefined : parseInt(e.target.value, 10) || 0)} 
                        />
                      </FormControl>
                      <FormMessage className="text-sm font-medium text-destructive mt-1" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="new_employees_covered"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Covered</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="0"
                          className="placeholder:text-slate-400" disabled={isViewMode}
                          value={field.value || ''}
                          onChange={e => field.onChange(e.target.value === '' ? undefined : parseInt(e.target.value, 10) || 0)} 
                        />
                      </FormControl>
                      <FormMessage className="text-sm font-medium text-destructive mt-1" />
                    </FormItem>
                  )}
                />
              </div>
            </div>
            <div>
              <h4 className="font-medium mb-2 text-slate-700 text-base">STAR Employees</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="star_employees_total"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Total</FormLabel>
                      <FormControl><Input type="number" placeholder="0" {...field} disabled={isViewMode} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)}/></FormControl>
                      <FormMessage className="text-sm font-medium text-destructive mt-1" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="star_employees_covered"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Covered</FormLabel>
                      <FormControl><Input type="number" placeholder="0" {...field} disabled={isViewMode} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)}/></FormControl>
                      <FormMessage className="text-sm font-medium text-destructive mt-1" />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md hover:shadow-lg border border-slate-200/50 hover:border-slate-300/50 transition-all duration-200 bg-white/80 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-base sm:text-lg font-semibold text-[#004C8F]">Qualitative Assessment</CardTitle>
          </CardHeader>
          <CardContent className="p-6 border-t border-slate-100/70">
            <div className="space-y-6">
              {qualitativeQuestions.map(q => (
                <FormField
                  key={q.name}
                  control={form.control}
                  name={q.name}
                  render={({ field }) => (
                    <FormItem className="pb-2 border-b border-slate-100 last:border-0">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 sm:gap-8">
                        <FormLabel className="text-sm font-medium text-slate-800 flex-1">{q.label}</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={isViewMode ? undefined : field.onChange}
                            value={field.value?.toString() || ''}
                            className="flex space-x-6 shrink-0"
                          >
                            <FormItem className="flex items-center space-x-2 space-y-0 hover:transform hover:scale-105 transition-transform duration-200">
                              <FormControl><RadioGroupItem value="yes" className="border-slate-300 text-[#004C8F] h-4 w-4" disabled={isViewMode} /></FormControl>
                              <FormLabel className="text-sm font-medium text-slate-600 cursor-pointer whitespace-nowrap">Yes</FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-2 space-y-0 hover:transform hover:scale-105 transition-transform duration-200">
                              <FormControl><RadioGroupItem value="no" className="border-slate-300 text-[#004C8F] h-4 w-4" disabled={isViewMode} /></FormControl>
                              <FormLabel className="text-sm font-medium text-slate-600 cursor-pointer whitespace-nowrap">No</FormLabel>
                            </FormItem>
                          </RadioGroup>
                        </FormControl>
                      </div>
                      <FormMessage className="text-xs sm:text-sm font-medium text-destructive mt-1" />
                    </FormItem>
                  )}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md hover:shadow-lg border border-slate-200/50 hover:border-slate-300/50 transition-all duration-200 bg-white/80 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-base sm:text-lg font-semibold text-[#004C8F]">Additional Remarks</CardTitle>
          </CardHeader>
          <CardContent className="p-6 border-t border-slate-100/70">
            <FormField
              control={form.control}
              name="additional_remarks"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="sr-only text-xs text-muted-foreground">Additional Remarks</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter any additional remarks (optional, max 1000 characters)..."
                      className="resize-y min-h-[100px] border border-slate-200 hover:border-slate-300 bg-white/80 placeholder:text-slate-400" disabled={isViewMode}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription className="text-sm text-muted-foreground mt-1">Maximum 1000 characters. Add any important observations or findings here.</FormDescription>
                  <FormMessage className="text-sm font-medium text-destructive mt-1" />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {!isViewMode && (
          <div className="flex flex-col sm:flex-row justify-end gap-4 pt-8 border-t">
            {/* Only show Save as Draft if the visit is a draft */}
            {initialData?.status === 'draft' && (
              <Button 
                type="button" 
                variant="outline" 
                onClick={form.handleSubmit(handleInternalSubmit('draft'))} 
                disabled={isSubmitting || isLoadingBranches || assignedBranches.length === 0} 
                className="w-full sm:w-auto bg-white hover:bg-slate-50 border border-slate-300 hover:border-slate-400"
              >
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {draftButtonText}
              </Button>
            )}
            {/* Only show Submit if the visit is a draft */}
            {initialData?.status === 'draft' && (
              <Button 
                type="submit" 
                className="w-full sm:w-auto bg-gradient-to-r from-[#004C8F] to-[#003B6F] hover:from-[#003B6F] hover:to-[#002B4F] text-white shadow-md hover:shadow-lg transition-all duration-200" 
                disabled={isSubmitting || isLoadingBranches || assignedBranches.length === 0}
              >
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                {submitButtonText}
              </Button>
            )}
          </div>
        )}
      </form>
    </Form>
  );
}
