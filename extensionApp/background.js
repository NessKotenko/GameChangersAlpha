const GEMINI_API_KEY = "";

// !!! IMPORTANT: Replace this with your actual Firebase Project ID !!!
const FIREBASE_PROJECT_ID = "antihoppingappp3"; 

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "analyzeChat") {
    analyzeWithGemini(request.chatLogs)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; 
  } else if (request.action === "reportIncident") {
    // Send to Firebase
    reportToCloudDatabase(request.data);
  }
});

async function reportToCloudDatabase(data) {
  chrome.storage.local.get(['kidId'], async (result) => {
    const kidId = result.kidId;
    if (!kidId) {
      console.error("Device not linked to a parent account!");
      return; 
    }

    // Convert richLogs to Firestore Map Array format
    const firestoreRichLogs = (data.richLogs || []).map(log => ({
      mapValue: {
        fields: {
          sender: { stringValue: log.sender || "Unknown" },
          text: { stringValue: log.text || "" },
          timestamp: { stringValue: log.timestamp || "" }
        }
      }
    }));

    const payload = {
      fields: {
        status: { stringValue: data.status || "Unknown" },
        reason: { stringValue: data.reason || "No reason provided" },
        attacker: { stringValue: data.attacker || "Unknown" },
        childName: { stringValue: data.childName || "Unknown User" },
        chatDuration: { stringValue: data.chatDuration || "Unknown" },
        riskScore: { integerValue: data.riskScore || 0 },
        timestamp: { stringValue: new Date().toISOString() },
        richLogs: { arrayValue: { values: firestoreRichLogs } }
      }
    };

    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/users/${kidId}/incidents`;
    
    try {
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      console.log("Incident successfully reported to Parent Dashboard.");
    } catch (err) {
      console.error("Failed to report to cloud:", err);
    }
  });
}

async function analyzeWithGemini(chatText) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`;
  
  const prompt = `You are a parental control security AI reading a Discord chat log.
Determine if the chat is safe or if it contains dangerous behaviors.
Strictly output a JSON object:
{
  "status": "safe" | "Harassment" | "Pedophilia" | "Physical Extortion" | "Verbal Abuse" | "Racism / Antisemitism",
  "severity": "safe" | "warning" | "danger",
  "riskScore": "Number between 0 and 100",
  "reason": "Provide a 1-sentence explanation of why in English."
}
Definitions:
- riskScore: 0-50 (Safe), 51-99 (Warning), 100 (Extreme Danger).
- safe: Normal friendly chat.
- severity: warning or danger.
- Harassment: Grooming, phishing links, or general danger.
- Pedophilia: Asking for inappropriate pictures or age probing.
- Physical Extortion: Blackmail, physical threats.
- Verbal Abuse: Severe verbal abuse or bullying.
- Racism / Antisemitism: Antisemitism or Racism.

Chat Log to analyze:
${chatText}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" },
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
      ]
    })
  });

  if (!response.ok) {
    const errData = await response.json().catch(()=>({}));
    throw new Error(`API error ${response.status}: ` + JSON.stringify(errData));
  }

  const data = await response.json();
  const candidate = data.candidates?.[0];

  const fr = candidate?.finishReason;
  if (fr && (fr === 'SAFETY' || fr === 'PROHIBITED_CONTENT' || fr === 'BLOCK' || fr === 'OTHER')) {
    return {
      status: "Pedophilia",
      severity: "danger",
      riskScore: 100,
      reason: `Blocked by Google Safety API (${fr}) due to extreme violation.`
    };
  }

  const resultText = candidate?.content?.parts?.[0]?.text;
  if (!resultText) throw new Error("Invalid response format from Gemini");

  let cleanJsonText = resultText.trim();
  if (cleanJsonText.startsWith("```json")) cleanJsonText = cleanJsonText.substring(7);
  if (cleanJsonText.endsWith("```")) cleanJsonText = cleanJsonText.substring(0, cleanJsonText.length - 3);

  return JSON.parse(cleanJsonText);
}