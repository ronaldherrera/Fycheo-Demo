
export interface TimeEntry {
  id: string;
  date: string;
  startTime: string;
  endTime?: string;
  type: 'manual' | 'automatic';
  status: 'complete' | 'ongoing' | 'warning';
  hours: string;
}

export interface User {
  name: string;
  role: string;
  id: string;
  email: string;
  dept: string;
  avatar: string;
}
