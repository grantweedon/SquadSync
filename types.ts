
export type FriendName = 'Grant' | 'Gary' | 'Stu' | 'Ian';

export enum AvailabilityStatus {
  FREE = 'FREE',
  BUSY = 'BUSY'
}

export interface WeekendAvailability {
  id: string;
  date: Date;
  status: Record<FriendName, AvailabilityStatus>;
}

export interface SquadInsight {
  summary: string;
  recommendation: string;
}
