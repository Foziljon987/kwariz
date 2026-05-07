export interface UserProfile {
  id: string; // Firebase UID
  name: string;
  surname: string;
  email: string;
  sex: string;
  country: string;
  region: string;
  jobTitle: string;
  role: 'admin' | 'user';
  paymentStatus: 'pending' | 'paid' | 'unlimited';
  billingMethod?: string;
  createdAt: number;
  lang?: string;
}

export interface Subject {
  name: string;
  hoursPerWeek: number;
}

export interface GradeConfig {
  grade: number;
  numClasses: number;
  subjects: Subject[];
}

export interface Teacher {
  id: string;
  name: string;
  preferredSubjects: string[];
  assignedClasses: string[]; // e.g. ["1 A", "5 B"]
  targetHours?: number;
}

export interface ScheduleEntry {
  day: string;
  startTime: string;
  endTime: string;
  grade: number;
  className: string;
  subject: string;
  teacher: string;
}

export interface ScheduleConflict {
  type: 'teacher_double_booking' | 'room_conflict' | 'other';
  description: string;
  entries: ScheduleEntry[];
}

export interface ScheduleResult {
  schedule: ScheduleEntry[];
  conflicts: ScheduleConflict[];
  stats: {
    teacherHours: Record<string, number>;
    gradeHours: Record<number, number>;
  };
}
