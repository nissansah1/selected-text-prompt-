// Jab bhi background script ko koi message mile
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Agar message ka type "gemini_request" hai
  if (request.type === "gemini_request") {
    // 🔐 Gemini API key (iss key ka secure use production mein karein)
    const GEMINI_API_KEY = "AIzaSyDZQZD3FtXgGxRLZmUPuHNbLvC1Vn-zhDc";

    // 📡 Gemini API endpoint URL banaya jaa raha hai
    const GEMINI_ENDPOINT =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" +
      GEMINI_API_KEY;

    // 📦 Request body banai ja rahi hai jisme user ka prompt hoga
    const body = {
      contents: [
        {
          role: "user", // User ka role define kar rahe hain
          parts: [{ text: request.prompt }], // User ka prompt yahan bheja jaa raha hai
        },
      ],
    };

    // 🚀 API ko POST request bhej rahe hain
    fetch(GEMINI_ENDPOINT, {
      method: "POST", // HTTP method POST hai
      headers: { "Content-Type": "application/json" }, // Header define kar rahe hain JSON ke liye
      body: JSON.stringify(body), // Body ko JSON string mein convert kar rahe hain
    })
      .then((res) => res.json()) // 🔁 Response ko JSON mein convert karte hain
      .then((data) => {
        // ✅ Gemini ka output extract kar rahe hain safely
        const output =
          data?.candidates?.[0]?.content?.parts?.[0]?.text ||
          "No response from Gemini."; // Agar koi text nahi mila toh fallback message
        sendResponse({ success: true, output }); // ✅ Response ko return kar rahe hain
      })
      .catch((err) => {
        // ❌ Agar koi error aata hai API se, toh yeh log aur message bhejte hain
        console.error("Gemini API error:", err);
        sendResponse({
          success: false,
          output: "Error contacting Gemini API.",
        });
      });

    return true; // ⏳ Asynchronous response ke liye required hai yeh return
  }
});
