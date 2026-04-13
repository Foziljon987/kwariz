import { GoogleGenAI, Type } from "@google/genai";
import { GradeConfig, Teacher, ScheduleResult } from "../types";

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
  teachers: Teacher[]
): Promise<ScheduleResult> {
  const ai = getAI();
  const prompt = `
    Create a school schedule based on the following data:
    
    Grades Configuration:
    ${JSON.stringify(grades, null, 2)}
    
    Teachers:
    ${JSON.stringify(teachers, null, 2)}
    
    Rules:
    - School starts at 8:00 AM.
    - Each lesson is 45 minutes.
    - 5-minute break between lessons.
    - Try to schedule one teacher's lessons in one order (consecutive if possible).
    - Detect and flag any conflicts.
    - Calculate total hours per teacher and per grade.
    - Days: Monday to Friday.
    
    Return the result in the specified JSON format.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
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
