
// This file is purely for TypeScript interfaces.
// It should NOT be loaded by the browser at runtime as Babel strips interfaces.
// The runtime 'AvailabilityStatus' object is now defined in constants.ts.

export type FriendName = 'Grant' | 'Gary' | 'Stu' | 'Ian';

export interface WeekendAvailability {
  id: string;
  date: Date;
  status: Record<FriendName, string>;
}

export interface SquadInsight {
  summary: string;
  recommendation: string;
}
