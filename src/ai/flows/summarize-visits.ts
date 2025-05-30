'use server';

/**
 * @fileOverview Summarizes visit reports across all branches and roles for CHR users.
 *
 * - summarizeVisits - A function that summarizes visit reports.
 * - SummarizeVisitsInput - The input type for the summarizeVisits function.
 * - SummarizeVisitsOutput - The return type for the summarizeVisits function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeVisitsInputSchema = z.object({
  reports: z.array(
    z.object({
      branch: z.string(),
      visitDate: z.string(),
      notes: z.string(),
      bhr: z.string(),
    })
  ).describe('An array of visit reports, each containing branch, visit date, notes and the BHR who made the visit.'),
});
export type SummarizeVisitsInput = z.infer<typeof SummarizeVisitsInputSchema>;

const SummarizeVisitsOutputSchema = z.object({
  summary: z.string().describe('A summary of the visit reports, highlighting key trends and potential issues.'),
});
export type SummarizeVisitsOutput = z.infer<typeof SummarizeVisitsOutputSchema>;

export async function summarizeVisits(input: SummarizeVisitsInput): Promise<SummarizeVisitsOutput> {
  return summarizeVisitsFlow(input);
}

const summarizeVisitsPrompt = ai.definePrompt({
  name: 'summarizeVisitsPrompt',
  input: {schema: SummarizeVisitsInputSchema},
  output: {schema: SummarizeVisitsOutputSchema},
  prompt: `You are an AI assistant helping the CHR to understand the overall health of the organization.
  Summarize the following visit reports, highlighting key trends and potential issues. 
  The reports are provided in JSON format.
  Ensure the summary is concise and actionable.

  Reports:
  {{#each reports}}
  Branch: {{this.branch}}
  Visit Date: {{this.visitDate}}
  Notes: {{this.notes}}
  BHR: {{this.bhr}}
  {{/each}}
  `,
});

const summarizeVisitsFlow = ai.defineFlow(
  {
    name: 'summarizeVisitsFlow',
    inputSchema: SummarizeVisitsInputSchema,
    outputSchema: SummarizeVisitsOutputSchema,
  },
  async input => {
    const {output} = await summarizeVisitsPrompt(input);
    return output!;
  }
);
