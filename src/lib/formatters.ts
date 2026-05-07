import { GradeConfig, ScheduleEntry, Teacher } from "../types";

export const normalizeTime = (tStr: string) => {
  if (!tStr) return "";
  const cleaned = tStr.trim();
  const match = cleaned.match(/(\d{1,2})[:.](\d{2})/);
  if (!match) return cleaned;
  return `${match[1].padStart(2, '0')}:${match[2]}`;
};

export const getCanonicalDay = (dayStr: string) => {
  if (!dayStr) return "";
  const d = dayStr.trim().toLowerCase();
  
  // Check English
  if (d.startsWith('mon')) return 'Monday';
  if (d.startsWith('tue')) return 'Tuesday';
  if (d.startsWith('wed')) return 'Wednesday';
  if (d.startsWith('thu')) return 'Thursday';
  if (d.startsWith('fri')) return 'Friday';
  if (d.startsWith('sat')) return 'Saturday';
  if (d.startsWith('sun')) return 'Sunday';
  
  // Check Uzbek
  if (d.startsWith('dus')) return 'Monday';
  if (d.startsWith('ses')) return 'Tuesday';
  if (d.startsWith('cho')) return 'Wednesday';
  if (d.startsWith('pay')) return 'Thursday';
  if (d.startsWith('jum')) return 'Friday';
  if (d.startsWith('sha')) return 'Saturday';
  if (d.startsWith('yak')) return 'Sunday';
  
  // Check Russian
  if (d.startsWith('пон')) return 'Monday';
  if (d.startsWith('вт')) return 'Tuesday';
  if (d.startsWith('сре')) return 'Wednesday';
  if (d.startsWith('чет')) return 'Thursday';
  if (d.startsWith('пят')) return 'Friday';
  if (d.startsWith('суб')) return 'Saturday';
  if (d.startsWith('вос')) return 'Sunday';
  
  return dayStr; // Fallback to original
};

export const isLessonMatch = (e: ScheduleEntry, day: string, slot: string, clsLabel: string) => {
  if (!e || !day || !slot || !clsLabel) return false;

  const eStart = normalizeTime(e.startTime);
  const eEnd = normalizeTime(e.endTime);
  const slotParts = slot.split('-');
  if (slotParts.length < 2) return false;
  
  const sStart = normalizeTime(slotParts[0]);
  const sEnd = normalizeTime(slotParts[1]);
  
  const timeMatch = eStart === sStart && eEnd === sEnd;
  
  const eDayCanonical = getCanonicalDay(e.day);
  const targetDayCanonical = getCanonicalDay(day);
  const dayMatch = eDayCanonical === targetDayCanonical;

  const eGradeStr = String(e.grade).trim();
  const eClassNameStr = String(e.className).trim().toUpperCase();
  
  const labelParts = clsLabel.split(' ');
  const labelGrade = labelParts[0].trim();
  const labelClass = labelParts.length > 1 ? labelParts.slice(1).join(' ').trim().toUpperCase() : labelParts[0].trim().toUpperCase();
  
  const labelMatch = (eGradeStr === labelGrade && (
    eClassNameStr === labelClass || 
    eClassNameStr === `${labelGrade} ${labelClass}` ||
    eClassNameStr === `${labelGrade}${labelClass}` ||
    eClassNameStr === `${labelGrade}-${labelClass}` ||
    (eClassNameStr.includes(labelClass) && eClassNameStr.length <= 6)
  )) || `${e.grade} ${e.className}` === clsLabel;

  return timeMatch && dayMatch && labelMatch;
};

export const validateSchedule = (schedule: any[]): schedule is ScheduleEntry[] => {
  if (!Array.isArray(schedule)) return false;
  return schedule.every(e => 
    typeof e.day === 'string' &&
    typeof e.startTime === 'string' &&
    typeof e.endTime === 'string' &&
    (typeof e.grade === 'number' || typeof e.grade === 'string') &&
    typeof e.className === 'string' &&
    typeof e.subject === 'string' &&
    typeof e.teacher === 'string'
  );
};

