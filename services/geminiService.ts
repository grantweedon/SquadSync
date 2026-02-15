
// The SDK is loaded in index.html via a module script and attached to window.
// We just need to access it here.

let ai: any = null;
let hasTriedInit = false;

const initAI = () => {
  if (hasTriedInit) return;
  hasTriedInit = true;

  try {
    const apiKey = (window as any).process?.env?.API_KEY;
    const GoogleGenAIClass = (window as any).GoogleGenAI;

    if (!GoogleGenAIClass) {
        console.warn("Gemini Service: GoogleGenAI class is missing from window. SDK might have failed to load.");
        return;
    }

    if (!apiKey) {
        console.warn("Gemini Service: No API Key found in process.env.");
        return;
    }

    ai = new GoogleGenAIClass({ apiKey });
    console.log("Gemini Service initialized successfully");

  } catch (e) {
    console.warn("Failed to initialize Google GenAI Service", e);
  }
};

const getSquadInsight = async (weekends: any[]) => {
  // Always try to init just in case it loaded late
  if (!ai) initAI();
  
  if (!ai) {
    // Try one more time to check window, maybe module loaded very late or network was slow
    const GoogleGenAIClass = (window as any).GoogleGenAI;
    if (GoogleGenAIClass) {
        hasTriedInit = false; // Reset to try again
        initAI();
    }
    
    if (!ai) {
        return {
          summary: "AI service is currently unavailable.",
          recommendation: "Check your internet connection or API Key configuration."
        };
    }
  }

  const scheduleData = weekends.map(w => ({
    date: w.date.toDateString(),
    availability: w.status
  }));

  const SchemaType = (window as any).SchemaType;
  
  // Default to STRING if SchemaType failed to load for some reason, though it should be there if AI is there
  const StringType = SchemaType ? SchemaType.STRING : 'STRING';
  const ObjectType = SchemaType ? SchemaType.OBJECT : 'OBJECT';

  try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview", 
        contents: `Analyze the following weekend availability for Grant, Gary, Stu, and Ian. 
        Identify patterns, the best opportunities for meetups, and suggest a creative activity for the "all-free" dates.
        
        Data: ${JSON.stringify(scheduleData)}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: ObjectType,
            properties: {
              summary: { 
                type: StringType, 
                description: "A short summary of the current schedule status." 
              },
              recommendation: { 
                type: StringType, 
                description: "A specific activity recommendation for the best upcoming date." 
              }
            },
            required: ["summary", "recommendation"]
          }
        }
      });

      return JSON.parse(response.text);
  } catch (e) {
    console.error("Gemini Error", e);
    return {
      summary: "Looks like the squad is busy! Keep searching for those green slots.",
      recommendation: "Plan a quick gaming session if weekends are too tight."
    };
  }
};

(window as any).getSquadInsight = getSquadInsight;