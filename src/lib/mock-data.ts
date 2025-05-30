
import type { User, Branch, Visit, Assignment, UserRole, VisitReportInput, VisitStatus } from '@/types';
import { addDays, formatISO, subDays } from 'date-fns';

export const mockUsers: User[] = [
  { id: 'chr-1', name: 'Alice Wonderland', email: 'alice@hrview.com', role: 'CHR' },
  { id: 'vhr-1', name: 'Bob The Builder', email: 'bob@hrview.com', role: 'VHR', reports_to: 'chr-1' },
  { id: 'vhr-2', name: 'Carol Danvers', email: 'carol@hrview.com', role: 'VHR', reports_to: 'chr-1' },
  { id: 'zhr-1', name: 'David Copperfield', email: 'david@hrview.com', role: 'ZHR', reports_to: 'vhr-1' },
  { id: 'zhr-2', name: 'Eve Harrington', email: 'eve@hrview.com', role: 'ZHR', reports_to: 'vhr-1' },
  { id: 'zhr-3', name: 'Frank Castle', email: 'frank@hrview.com', role: 'ZHR', reports_to: 'vhr-2' },
  { id: 'bhr-1', name: 'Grace Hopper', email: 'grace@hrview.com', role: 'BHR', reports_to: 'zhr-1' },
  { id: 'bhr-2', name: 'Hank Pym', email: 'hank@hrview.com', role: 'BHR', reports_to: 'zhr-1' },
  { id: 'bhr-3', name: 'Ivy Pepper', email: 'ivy@hrview.com', role: 'BHR', reports_to: 'zhr-2' },
  { id: 'bhr-4', name: 'Jack Sparrow', email: 'jack@hrview.com', role: 'BHR', reports_to: 'zhr-3' },
];

export const mockBranches: Branch[] = [
  { id: 'branch-1', name: 'North Star Branch', location: 'New York', category: 'Metro Tier A', code: 'NY001' },
  { id: 'branch-2', name: 'Southern Cross Branch', location: 'Los Angeles', category: 'Metro Tier A', code: 'LA001' },
  { id: 'branch-3', name: 'East Gate Branch', location: 'Chicago', category: 'Metro Tier B', code: 'CH001' },
  { id: 'branch-4', name: 'West End Branch', location: 'Houston', category: 'Urban Tier A', code: 'HO001' },
  { id: 'branch-5', name: 'Central Hub', location: 'Phoenix', category: 'Urban Tier B', code: 'PH001' },
  { id: 'branch-6', name: 'Metro Point', location: 'Philadelphia', category: 'Metro Tier B', code: 'PL001' },
];

export const mockAssignments: Assignment[] = [
  { id: 'assign-1', bhr_id: 'bhr-1', branch_id: 'branch-1' },
  { id: 'assign-2', bhr_id: 'bhr-1', branch_id: 'branch-2' },
  { id: 'assign-3', bhr_id: 'bhr-2', branch_id: 'branch-3' },
  { id: 'assign-4', bhr_id: 'bhr-3', branch_id: 'branch-4' },
  { id: 'assign-5', bhr_id: 'bhr-3', branch_id: 'branch-5' },
  { id: 'assign-6', bhr_id: 'bhr-4', branch_id: 'branch-6' },
];

const today = new Date();
export const mockVisits: Visit[] = [
  {
    id: 'visit-1', bhr_id: 'bhr-1', bhr_name: 'Grace Hopper', branch_id: 'branch-1', branch_name: 'North Star Branch',
    visit_date: formatISO(subDays(today, 5)),
    additional_remarks: 'Productive visit. Discussed Q3 targets and employee morale. Some concerns about new software rollout.',
    hr_connect_conducted: true,
    manning_percentage: 95,
    attrition_percentage: 5,
    performance_level: 'Good',
    status: 'approved',
  },
  {
    id: 'visit-2', bhr_id: 'bhr-1', bhr_name: 'Grace Hopper', branch_id: 'branch-2', branch_name: 'Southern Cross Branch',
    visit_date: formatISO(subDays(today, 12)),
    additional_remarks: 'Routine check-in. Staff engagement seems high. Followed up on training completion.',
    hr_connect_conducted: false,
    manning_percentage: 98,
    attrition_percentage: 3,
    performance_level: 'Excellent',
    status: 'submitted',
  },
  {
    id: 'visit-3', bhr_id: 'bhr-2', bhr_name: 'Hank Pym', branch_id: 'branch-3', branch_name: 'East Gate Branch',
    visit_date: formatISO(subDays(today, 2)),
    additional_remarks: 'Addressed some minor operational issues. Branch manager is proactive. Overall positive.',
    hr_connect_conducted: true,
    manning_percentage: 90,
    attrition_percentage: 7,
    performance_level: 'Average',
    status: 'draft',
  },
  {
    id: 'visit-4', bhr_id: 'bhr-3', bhr_name: 'Ivy Pepper', branch_id: 'branch-4', branch_name: 'West End Branch',
    visit_date: formatISO(subDays(today, 20)),
    additional_remarks: 'Met with new hires. Onboarding process seems smooth. Identified need for more team-building activities.',
    hr_connect_conducted: true,
    manning_percentage: 100,
    attrition_percentage: 2,
    performance_level: 'Good',
    status: 'approved',
  },
  {
    id: 'visit-5', bhr_id: 'bhr-4', bhr_name: 'Jack Sparrow', branch_id: 'branch-6', branch_name: 'Metro Point',
    visit_date: formatISO(subDays(today, 7)),
    additional_remarks: 'Investigated a reported conflict. Resolution plan in place. Will monitor.',
    hr_connect_conducted: false,
    manning_percentage: 92,
    attrition_percentage: 6,
    performance_level: 'Needs Improvement',
    status: 'rejected',
  },
  {
    id: 'visit-6', bhr_id: 'bhr-1', bhr_name: 'Grace Hopper', branch_id: 'branch-1', branch_name: 'North Star Branch',
    visit_date: formatISO(subDays(today, 35)),
    additional_remarks: 'Follow-up on software rollout. Most issues resolved. Training materials updated.',
    hr_connect_conducted: true,
    manning_percentage: 96,
    attrition_percentage: 4,
    performance_level: 'Good',
    status: 'approved',
  },
];


export const mockVisitReportInputs: VisitReportInput[] = mockVisits.map(v => ({
  branch: v.branch_name,
  visitDate: v.visit_date,
  notes: v.additional_remarks || '', // Use additional_remarks for AI summary
  bhr: v.bhr_name,
}));


// Helper function to get data based on user role and hierarchy
export const getVisibleUsers = (currentUser: User): User[] => {
  if (!currentUser) return [];
  switch (currentUser.role) {
    case 'CHR':
      return mockUsers;
    case 'VHR':
      const vhrZhrs = mockUsers.filter(u => u.role === 'ZHR' && u.reports_to === currentUser.id);
      const vhrBhrs = mockUsers.filter(u => u.role === 'BHR' && vhrZhrs.find(z => z.id === u.reports_to));
      return [currentUser, ...vhrZhrs, ...vhrBhrs];
    case 'ZHR':
      const zhrBhrs = mockUsers.filter(u => u.role === 'BHR' && u.reports_to === currentUser.id);
      return [currentUser, ...zhrBhrs];
    case 'BHR':
      return [currentUser];
    default:
      return [];
  }
};

export const getVisibleVisits = (currentUser: User): Visit[] => {
  if (!currentUser) return [];
  const visibleUserIds = getVisibleUsers(currentUser).map(u => u.id);
  switch (currentUser.role) {
    case 'CHR':
    case 'VHR':
      return mockVisits.filter(v => visibleUserIds.includes(v.bhr_id));
    case 'ZHR':
      return mockVisits.filter(v => visibleUserIds.includes(v.bhr_id) && mockUsers.find(u => u.id === v.bhr_id)?.reports_to === currentUser.id);
    case 'BHR':
      return mockVisits.filter(v => v.bhr_id === currentUser.id);
    default:
      return [];
  }
};

export const getVisibleBranchesForBHR = (bhrId: string): Branch[] => {
  const assignedBranchIds = mockAssignments.filter(a => a.bhr_id === bhrId).map(a => a.branch_id);
  return mockBranches.filter(b => assignedBranchIds.includes(b.id));
};

export const getVisibleBranchesForZHR = (zhrId: string): Branch[] => {
  const bhrIdsUnderZhr = mockUsers.filter(u => u.role === 'BHR' && u.reports_to === zhrId).map(u => u.id);
  const assignedBranchIds = mockAssignments.filter(a => bhrIdsUnderZhr.includes(a.bhr_id)).map(a => a.branch_id);
  // Unique branch IDs
  return mockBranches.filter(b => Array.from(new Set(assignedBranchIds)).includes(b.id));
};
// Add more complex data retrieval logic as needed for VHR/CHR or specific filters
