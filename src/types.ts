export interface UserProfile {
  name: string;
  surname: string;
  email: string;
  sex: string;
  country: string;
  region: string;
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
