import * as XLSX from 'xlsx';
import { ScheduleEntry } from '../types';

export function exportScheduleToExcel(schedule: ScheduleEntry[]) {
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const classNames = Array.from(new Set(schedule.map(e => `G${e.grade} ${e.className}`))).sort();
  const timeSlots = Array.from(new Set(schedule.map(e => `${e.startTime}-${e.endTime}`))).sort();

  const data: any[] = [];

  // Header Row
  const header = ["Kun", "#", "Vaqt", ...classNames];
  data.push(header);

  days.forEach(day => {
    const daySlots = timeSlots.filter(slot => 
      schedule.some(e => e.day === day && `${e.startTime}-${e.endTime}` === slot)
    );

    daySlots.forEach((slot, slotIdx) => {
      const row: any[] = [];
      row.push(slotIdx === 0 ? day : ""); // Only show day for the first slot
      row.push(slotIdx + 1);
      row.push(slot);

      classNames.forEach(cls => {
        const entry = schedule.find(e => 
          e.day === day && 
          `${e.startTime}-${e.endTime}` === slot && 
          `G${e.grade} ${e.className}` === cls
        );
        row.push(entry ? `${entry.subject}\n${entry.teacher}` : "");
      });
      data.push(row);
    });
    
    // Add an empty row between days
    data.push([]);
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
