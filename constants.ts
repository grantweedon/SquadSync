
import { FriendName, AvailabilityStatus } from './types';

export const FRIENDS: FriendName[] = ['Grant', 'Gary', 'Stu', 'Ian'];

export const FRIEND_COLORS: Record<FriendName, string> = {
  'Grant': 'bg-blue-500',
  'Gary': 'bg-purple-500',
  'Stu': 'bg-amber-500',
  'Ian': 'bg-emerald-500'
};

// Generate 20 Saturdays starting from May 9, 2026
export const INITIAL_WEEKENDS = Array.from({ length: 20 }).map((_, i) => {
  // May 9, 2026 is a Saturday. Month index 4 is May.
  const d = new Date(2026, 4, 9); 
  d.setDate(d.getDate() + (i * 7));
  d.setHours(0, 0, 0, 0);
  
  return {
    id: d.toISOString(),
    date: d,
    status: {
      'Grant': AvailabilityStatus.BUSY,
      'Gary': AvailabilityStatus.BUSY,
      'Stu': AvailabilityStatus.BUSY,
      'Ian': AvailabilityStatus.BUSY
    }
  };
});
