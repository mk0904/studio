
'use client';

import React, { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Sparkles } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { summarizeVisits } from '@/ai/flows/summarize-visits';
import type { VisitReportInput } from '@/types'; // Ensure this type is correctly defined
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface VisitSummaryAiProps {
  visitReports: VisitReportInput[]; // Expects an array of reports matching the AI flow input
}

export function VisitSummaryAi({ visitReports }: VisitSummaryAiProps) {
  const [summary, setSummary] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleGenerateSummary = () => {
    if (visitReports.length === 0) {
      toast({
        title: "No Reports",
        description: "There are no visit reports to summarize.",
        variant: "default",
      });
      return;
    }

    startTransition(async () => {
      try {
        const result = await summarizeVisits({ reports: visitReports });
        setSummary(result.summary);
        toast({
          title: "Summary Generated",
          description: "AI has successfully summarized the visit reports.",
        });
      } catch (error) {
        console.error("Error generating summary:", error);
        setSummary("Failed to generate summary. Please try again.");
        toast({
          title: "Error",
          description: "Could not generate summary. Check console for details.",
          variant: "destructive",
        });
      }
    });
  };

  return (
    <Card className="shadow-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-accent" />
          AI-Powered Visit Summary
        </CardTitle>
        <CardDescription>
          Get an intelligent summary of all visit reports. This helps identify key trends and potential issues across the organization.
          This may take a few moments.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={handleGenerateSummary} disabled={isPending || visitReports.length === 0}>
          {isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          Generate Summary ({visitReports.length} reports)
        </Button>

        {summary && (
          <Alert>
            <Sparkles className="h-4 w-4" />
            <AlertTitle>Generated Summary</AlertTitle>
            <AlertDescription className="whitespace-pre-wrap text-sm leading-relaxed py-2">
              {summary}
            </AlertDescription>
          </Alert>
        )}
         {!summary && isPending && (
            <div className="text-center py-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                <p className="mt-2 text-muted-foreground">Generating summary, please wait...</p>
            </div>
        )}
      </CardContent>
    </Card>
  );
}
