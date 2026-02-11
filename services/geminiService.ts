
import { GoogleGenAI, Type } from "@google/genai";
import { WeekendAvailability, SquadInsight } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getSquadInsight = async (weekends: WeekendAvailability[]): Promise<SquadInsight> => {
  const scheduleData = weekends.map(w => ({
    date: w.date.toDateString(),
    availability: w.status
  }));

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Analyze the following weekend availability for Grant, Gary, Stu, and Ian. 
    Identify patterns, the best opportunities for meetups, and suggest a creative activity for the "all-free" dates.
    
    Data: ${JSON.stringify(scheduleData)}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { 
            type: Type.STRING, 
            description: "A short summary of the current schedule status." 
          },
          recommendation: { 
            type: Type.STRING, 
            description: "A specific activity recommendation for the best upcoming date." 
          }
        },
        required: ["summary", "recommendation"]
      }
    }
  });

  try {
    return JSON.parse(response.text) as SquadInsight;
  } catch (e) {
    return {
      summary: "Looks like the squad is busy! Keep searching for those green slots.",
      recommendation: "Plan a quick gaming session if weekends are too tight."
    };
  }
};
