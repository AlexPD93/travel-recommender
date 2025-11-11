import { NextRequest, NextResponse } from "next/server";

// Define the required JSON output schema for strict structured generation.
const citySchema = {
  type: "OBJECT",
  properties: {
    city: { type: "STRING", description: "The name of the recommended travel destination city." },
    country: {type: "STRING", description: "The name of the recommended travel country."},
    recommendation: {type: "STRING", description: "Explanation of what they can do based on the activity."}
  },
  required: ["city", "country", "recommendation"],
};

export async function POST(req: NextRequest) {
  try {
    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (!geminiApiKey) {
      // This is the first common cause of a 500 error if the key isn't set.
      return NextResponse.json({ error: "GEMINI_API_KEY environment variable not set" }, { status: 500 });
    }

    const body = await req.json();
    const { username, age, style, activity } = body;

    if (!username || !age || !style || !activity) {
      return NextResponse.json({ error: "missing fields" }, { status: 400 });
    }

    // The user prompt is now focused on the task, as the output structure is handled by the generation config.
    const prompt = `
      Recommend exactly one travel destination city for user ${username}. 
      The city should align with the following preferences:
      - Age: ${age}
      - Travel Style: ${style}
      - Favourite Activity: ${activity}
      
      Respond with a JSON object containing the recommended city name, country and two sentences explaining what they can do in that city based on their favourite activity and travel style and age.
    `;

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${geminiApiKey}`;
    
    // Construct the payload for the Gemini API
    const payload = {
      // 1. Pass the user prompt as contents
      contents: [{ parts: [{ text: prompt }] }],
      // 2. Enforce JSON output using generationConfig (FIXED: changed 'config' to 'generationConfig')
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: citySchema,
      },
    };

    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorDetail = await res.text();
      // Log the full detail to the server console for debugging the exact reason the API rejected the request.
      console.error("Gemini API error status:", res.status, "detail:", errorDetail);
      return NextResponse.json({ error: "Gemini API request failed" }, { status: 500 });
    }

    const data = await res.json();
    
    // Extract the JSON string from the specific Gemini response structure
    // This string is guaranteed to be valid JSON due to the responseSchema configuration
    const rawJsonText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawJsonText) {
      console.error("Gemini API response missing structured text content:", data);
      return NextResponse.json({ error: "Could not get structured recommendation from AI" }, { status: 500 });
    }

    let city = "";
    let country = "";
    let recommendation = "";
    
    try {
      // Parse the guaranteed JSON string
      const parsed = JSON.parse(rawJsonText);
      city = parsed.city;
      country = parsed.country;
      recommendation = parsed.recommendation;
    } catch (e) {
      console.error("Failed to parse JSON response from LLM:", rawJsonText, e);
      return NextResponse.json({ error: "Invalid JSON format from AI" }, { status: 500 });
    }

    if (!city) {
       return NextResponse.json({ error: "AI response missing 'city' field" }, { status: 500 });
    }

    if (!country) {
       return NextResponse.json({ error: "AI response missing 'country' field" }, { status: 500 });
    }

    if (!recommendation) {
       return NextResponse.json({ error: "AI response missing 'recommendation' field" }, { status: 500 });
    }

    return NextResponse.json({ city, country, recommendation });
  } catch (err) {
    console.error("Server processing error", err);
    // If the error is a TypeError during JSON parsing of the request body (e.g., headers missing), log details.
    if (err instanceof TypeError) {
      console.error("Possible cause: Request body parsing error (e.g., invalid JSON in POST body)");
    }
    return NextResponse.json({ error: "Server processing error" }, { status: 500 });
  }
}