import { GoogleGenAI, Type } from "@google/genai";
import { GradeConfig, Teacher, ScheduleResult, Subject } from "../types";

let aiInstance: GoogleGenAI | null = null;

function getAI() {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is missing. Please add it to your Vercel Environment Variables.");
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

export async function generateSchedule(
  grades: GradeConfig[],
  teachers: Teacher[],
  country: string,
  region: string,
  lang: string
): Promise<ScheduleResult> {
  const ai = getAI();
  const prompt = `
    Create a school schedule for ${country}, ${region} in ${lang}.
    
    DATA:
    Grades: ${JSON.stringify(grades)}
    Teachers: ${JSON.stringify(teachers)}
    
    RULES:
    1. CLASS NAMES: Use ONLY "Number Letter" format (e.g., "1 A", "1 B", "2 A", "5 C").
    2. NO CONFLICTS: A teacher or class cannot have two lessons simultaneously.
    3. FULL TIMETABLE: You MUST fill as many slots as possible. Each class MUST have at least 6-8 lessons scheduled EVERY day (Monday-Friday).
       - If you have Grade 5 with 3 classes (A, B, C), you must provide schedules for: "5 A", "5 B", and "5 C".
       - Total lessons intended: (Number of total classes) * (Avg 7 lessons/day) * 5 days.
    4. VARIETY: One subject per class/day. Spread multi-hour subjects across the week.
    5. SLOTS (45m + 5m break): 08:00-08:45, 08:50-09:35, 09:40-10:25, 10:30-11:15, 11:20-12:05, 12:10-12:55, 13:00-13:45, 13:50-14:35.
    
    CRITICAL FORMATTING:
    - "day" MUST be one of: "Monday", "Tuesday", "Wednesday", "Thursday", "Friday".
    - "startTime" and "endTime" MUST match the slots above exactly.
    - "grade" is the number (e.g., 5).
    - "className" is ONLY the letter (e.g., "A").
    
    CRITICAL UZBEK TRANSLATIONS:
    MANDATORY MAPPING: You MUST use these exact Uzbek names for ALL subject names in the entire output:
    - Mathematics -> Matematika
    - English -> Ingliz tili
    - History -> Tarix
    - Literature -> Adabiyot
    - Biology -> Biologiya
    - Physics -> Fizika
    - Chemistry -> Kimyo
    - Native Language -> Ona tili
    - Sports -> Jismoniy tarbiya
    - Informatics -> Informatika
    - Art -> Tasviriy san'at
    - Music -> Musiqa
    - Geography -> Geografiya
    - Technology -> Texnologiya
    - Education for Democracy -> Tarbiya

    Return strictly JSON matching the schema.
    
    CRITICAL:
    1. LANGUAGE: Every subject name MUST be translated into ${lang} (Uzbek preferred).
    2. COMPLETENESS: A partial schedule is a failure. Fill every day from 08:00 to at least 13:45.
    3. FORMATTING: Use "day", "startTime", "endTime", "grade", "className" (Letter only).
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          schedule: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                day: { type: Type.STRING },
                startTime: { type: Type.STRING },
                endTime: { type: Type.STRING },
                grade: { type: Type.NUMBER },
                className: { type: Type.STRING },
                subject: { type: Type.STRING },
                teacher: { type: Type.STRING },
              },
              required: ["day", "startTime", "endTime", "grade", "className", "subject", "teacher"],
            },
          },
          conflicts: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING },
                description: { type: Type.STRING },
                entries: { type: Type.ARRAY, items: { type: Type.OBJECT } },
              },
              required: ["type", "description", "entries"],
            },
          },
          stats: {
            type: Type.OBJECT,
            properties: {
              teacherHours: { type: Type.OBJECT, additionalProperties: { type: Type.NUMBER } },
              gradeHours: { type: Type.OBJECT, additionalProperties: { type: Type.NUMBER } },
            },
            required: ["teacherHours", "gradeHours"],
          },
        },
        required: ["schedule", "conflicts", "stats"],
      },
    },
  });

  if (!response.text) {
    throw new Error("Failed to generate schedule");
  }

  return JSON.parse(response.text) as ScheduleResult;
}

export async function suggestSubjects(
  country: string,
  region: string,
  grade: number,
  lang: string
): Promise<Subject[]> {
  const ai = getAI();
  const prompt = `
    Suggest a list of typical school subjects for Grade ${grade} in ${country}, ${region}.
    
    Target Language: ${lang}
    
    REQUIREMENT: The total hours per week should sum up to approximately 35-40 hours to support a schedule with at least 7 lessons per day.
    Example: [{"name": "Mathematics", "hoursPerWeek": 5}, {"name": "Physics", "hoursPerWeek": 3}]
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            hoursPerWeek: { type: Type.NUMBER },
          },
          required: ["name", "hoursPerWeek"],
        },
      },
    },
  });

  return JSON.parse(response.text || "[]") as Subject[];
}

export async function suggestTeachers(
  subjects: string[],
  totalClasses: number,
  lang: string
): Promise<Teacher[]> {
  const ai = getAI();
  const prompt = `
    Given these subjects: ${subjects.join(", ")} and a total of ${totalClasses} classes, suggest a sufficient list of teachers.
    
    Target Language: ${lang}
    
    GUIDELINE: Ensure there are enough teachers so that at peak times (when multiple classes have the same subject), the schedule remains feasible. Suggest approximately 1 teacher for every 2-3 total classes for major subjects, or at least 2-3 teachers per subject if classes are numerous.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            name: { type: Type.STRING },
            preferredSubjects: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ["id", "name", "preferredSubjects"],
        },
      },
    },
  });

  return JSON.parse(response.text || "[]") as Teacher[];
}
