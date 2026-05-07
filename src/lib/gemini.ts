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

async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  let lastError: any;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      console.warn(`Attempt ${i + 1} failed: ${error.message}. Retrying in ${delay}ms...`);
      if (error.message?.includes("fetch") || error.message?.includes("XHR") || error.message?.includes("Unknown Error")) {
        await new Promise(res => setTimeout(res, delay * (i + 1))); // Exponential-ish backoff
        continue;
      }
      throw error; // Rethrow if not a transient network error
    }
  }
  throw lastError;
}

export async function suggestTeachers(
  grades: GradeConfig[],
  country: string,
  region: string,
  lang: string
): Promise<Teacher[]> {
  return withRetry(async () => {
    const ai = getAI();
    const classes = grades.flatMap(g => {
      const classLabels = [];
      for (let i = 0; i < g.numClasses; i++) {
        classLabels.push(`${g.grade} ${String.fromCharCode(65 + i)}`);
      }
      return classLabels;
    });

    const prompt = `
      Suggest a sufficient list of teachers for the following school configuration in ${country}, ${region}.
      
      CRITICAL: ALL TEACHER NAMES, SUBJECT NAMES, AND OUTPUT MUST BE IN THE TARGET LANGUAGE: ${lang}.
      Example: If lang is 'uz', use 'Matematika' instead of 'Mathematics', 'Ism Sharif' instead of 'John Doe'.
      
      GRADES AND SUBJECTS:
      ${JSON.stringify(grades)}
      
      CLASSES TO COVER:
      ${classes.join(", ")}
      
      TASK:
      1. Provide names and IDs (UUIDs) for teachers.
      2. Suggest which subjects each teacher should prefer (IN ${lang}).
      3. AUTOMATICALLY ASSIGN specific classes from the list above to each teacher.
      4. Provide a target weekly load for each teacher (typical 20-30 hours).
      
      CRITICAL: Ensure every subject hour for every class is covered by at least one teacher's preferred subjects and assigned classes.
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
              assignedClasses: { type: Type.ARRAY, items: { type: Type.STRING } },
              targetHours: { type: Type.NUMBER },
            },
            required: ["id", "name", "preferredSubjects", "assignedClasses", "targetHours"],
          },
        },
      },
    });

    return JSON.parse(response.text || "[]") as Teacher[];
  });
}

export async function generateSchedule(
  grades: GradeConfig[],
  teachers: Teacher[],
  country: string,
  region: string,
  lang: string
): Promise<ScheduleResult> {
  return withRetry(async () => {
    const ai = getAI();
    const prompt = `
      Create a COMPLETE and precision school schedule for ALL classes in ${country}, ${region}.
      
      TARGET LANGUAGE: ${lang}. ALL subject names and days MUST be in ${lang}.
      
      REQUIRED CLASSES TO SCHEDULE:
      ${grades.flatMap(g => Array.from({length: g.numClasses}, (_, i) => `${g.grade} ${String.fromCharCode(65 + i)}`)).join(", ")}

      DATA:
      Grades/Subjects: ${JSON.stringify(grades)}
      Teachers: ${JSON.stringify(teachers)}
      
      RULES (ABSOLUTE - FAIL IF NOT MET):
      1. EVERY CLASS COVERED: You MUST generate a full schedule for EVERY class listed in the "REQUIRED CLASSES TO SCHEDULE" section above. If you skip any class, the output is considered a failure.
      2. CLASS NAMES: Use ONLY "Number Letter" format (e.g., "1 A", "5 C"). 
      3. SUBJECT LOCALIZATION: Use ${lang} for all subject names. Ensure names match the teacher's preferredSubjects and the Grade's subjects.
      4. FULL COVERAGE: Every single class listed MUST receive a COMPLETE weekly timetable (Monday-Friday). If a subject has 5 hours/week, it MUST appear exactly 5 times for that class in the schedule.
      5. NO CONFLICTS: A teacher or class cannot have two lessons at the same time slot on the same day.
      6. SUBJECT VARIETY: DO NOT repeat the same subject in the same day for any single class.
      7. SUBJECT BALANCE: Distribute cognitively demanding subjects (e.g., Math, Science) across the week and prioritize them for earlier morning slots (Slots 1-4).
      8. NO GAPS: Fill every daily schedule sequentially starting from Slot 1 (08:00). Avoid empty periods between lessons.
      9. TEACHER CONSTRAINTS: 
         - Teachers MUST teach their assignedClasses and preferredSubjects.
         - Maximize teacher utilization to ensure 100% coverage for all students.
      10. SLOTS: 08:00-08:45, 08:50-09:35, 09:40-10:25, 10:30-11:15, 11:20-12:05, 12:10-12:55, 13:00-13:45, 13:50-14:35.
      
      Return strictly JSON matching the schema. TOTAL coverage is the highest priority.
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
          },
          required: ["schedule", "conflicts"],
        },
      },
    });

    if (!response.text) {
      throw new Error("Failed to generate schedule: Empty response from AI");
    }

    try {
      const parsed = JSON.parse(response.text) as any;
      
      // Basic validation and normalization of result
      if (!Array.isArray(parsed.schedule)) {
        throw new Error("Invalid schedule format: schedule property is not an array");
      }

      // Deep normalization
      const normalizedSchedule = parsed.schedule.map((e: any) => {
        const cleanGrade = String(e.grade).replace(/\D/g, '');
        let cleanClass = String(e.className).trim().toUpperCase();
        
        // If className already contains the grade (e.g. "5 A" or "G5 A"), strip it
        cleanClass = cleanClass
          .replace(new RegExp(`^G?${cleanGrade}\\s*`, 'i'), '')
          .replace(new RegExp(`^GRADE\\s*${cleanGrade}\\s*`, 'i'), '')
          .trim();
        
        if (!cleanClass) cleanClass = 'A'; // Fallback

        return {
          ...e,
          grade: parseInt(cleanGrade) || 1,
          className: cleanClass,
          startTime: (e.startTime || "").trim(),
          endTime: (e.endTime || "").trim(),
          day: (e.day || "").trim()
        };
      });

      return {
        schedule: normalizedSchedule,
        conflicts: parsed.conflicts || [],
        stats: { teacherHours: {}, gradeHours: {} } // Will be calculated in frontend
      };
    } catch (e: any) {
      console.error("Failed to parse Gemini response:", response.text);
      throw new Error(`Failed to parse AI response: ${e.message}`);
    }
  });
}

export async function suggestSubjects(
  country: string,
  region: string,
  grade: number,
  lang: string
): Promise<Subject[]> {
  return withRetry(async () => {
    const ai = getAI();
    const prompt = `
      Suggest a list of typical school subjects for Grade ${grade} in ${country}, ${region}.
      
      CRITICAL: ALL SUBJECT NAMES MUST BE IN THE TARGET LANGUAGE: ${lang}.
      Example: If lang is 'uz', return 'Matematika', 'Fizika', 'Ona tili', 'Adabiyot'.
      
      REQUIREMENT: The total hours per week should sum up to approximately 35-40 hours to support a schedule with at least 7 lessons per day.
      Example formatted in English but return in ${lang}: [{"name": "Mathematics", "hoursPerWeek": 5}, {"name": "Physics", "hoursPerWeek": 3}]
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
  });
}
