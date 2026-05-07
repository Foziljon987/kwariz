import * as XLSX from 'xlsx';
import { ScheduleEntry } from '../types';
import { getCanonicalDay, normalizeTime } from './formatters';

export function exportScheduleToExcel(schedule: ScheduleEntry[]) {
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  
  // Normalize schedule slots
  const normalizedSchedule = schedule.map(e => ({
    ...e,
    startTime: normalizeTime(e.startTime),
    endTime: normalizeTime(e.endTime),
    canonicalDay: getCanonicalDay(e.day)
  }));

  const classNames = Array.from(new Set(normalizedSchedule.map(e => `${e.grade} ${e.className}`))).sort();
  const timeSlots = Array.from(new Set(normalizedSchedule.map(e => `${e.startTime}-${e.endTime}`))).sort((a, b) => {
    const aStart = a.split('-')[0].replace(/\D/g, '').padStart(4, '0');
    const bStart = b.split('-')[0].replace(/\D/g, '').padStart(4, '0');
    return aStart.localeCompare(bStart);
  });

  const data: any[] = [];

  // Header Row
  const header = ["Kun", "#", "Vaqt", ...classNames];
  data.push(header);

  days.forEach(day => {
    const canonicalDay = getCanonicalDay(day);
    const dayEntries = normalizedSchedule.filter(e => e.canonicalDay === canonicalDay);
    const daySlots = Array.from(new Set(dayEntries.map(e => `${e.startTime}-${e.endTime}`))).sort();

    // Use all observed time slots for this day to keep it consistent
    const activeSlots = daySlots.length > 0 ? daySlots : [];

    activeSlots.forEach((slot, slotIdx) => {
      const row: any[] = [];
      row.push(slotIdx === 0 ? day : ""); // Only show day for the first slot
      row.push(slotIdx + 1);
      row.push(slot);

      classNames.forEach(cls => {
        const entry = dayEntries.find(e => 
          `${e.startTime}-${e.endTime}` === slot && 
          `${e.grade} ${e.className}` === cls
        );
        row.push(entry ? `${entry.subject}\n${entry.teacher}` : "");
      });
      data.push(row);
    });
    
    if (activeSlots.length > 0) {
      // Add an empty row between days
      data.push([]);
    }
  });

  const worksheet = XLSX.utils.aoa_to_sheet(data);
  
  // Basic styling (column widths)
  const wscols = [
    { wch: 12 }, // Kun
    { wch: 5 },  // #
    { wch: 15 }, // Vaqt
    ...classNames.map(() => ({ wch: 20 }))
  ];
  worksheet['!cols'] = wscols;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Schedule");

  XLSX.writeFile(workbook, "School_Schedule.xlsx");
}
