let promptBox = null;
let storedSelectedText = "";
let storedPrompt = "";

// Listen for hotkey (Ctrl + Shift + X)
document.addEventListener("keydown", function (e) {
  if (e.ctrlKey && e.shiftKey && e.key === "X") {
    const selectedText = window.getSelection().toString().trim();
    if (!selectedText) {
      alert("Please select some text first.");
      return;
    }
    showPopupInputNearSelection(
      (input) => {
        const fullPrompt = `Perform the task: "${input}" (keep task label under 4 words).

Show the output clearly with a heading based on the task.

Do not include explanations or filler text. Just return:

[Task Heading]

[Transformed Output]

Text:
${selectedText}

`;

        sendToGemini(fullPrompt);
      },
      () => {
        console.log("Prompt canceled.");
      }
    );
  }
});

//redo the current render text
document.addEventListener("keydown", function (e) {
  // Ctrl + Shift + E check kar rahe hain
  if (e.ctrlKey && e.shiftKey && e.key === "E") {
    if (responseAnchors.size === 0) {
      // Remove all rendered response divs from the page
      document
        .querySelectorAll(".gemini-response-box")
        .forEach((el) => el.remove());
      alert("All rendered responses have been removed.");
      return;
    }

    // 🔁 Map entries ko array mein convert karke last entry nikaalte hain
    const entries = Array.from(responseAnchors.entries());
    const [lastKey, lastOutputDiv] = entries[entries.length - 1];

    if (!lastOutputDiv) {
      console.warn("No output div found to remove.");
      return;
    }

    // 🔍 Parent node check kar ke DOM se remove karte hain
    if (lastOutputDiv.parentNode) {
      lastOutputDiv.remove();
    }

    // ❌ responseAnchors mein se entry hata dete hain
    responseAnchors.delete(lastKey);
  }
});

function showPopupInputNearSelection(onSubmit, onCancel) {
  const existingPopup = document.getElementById("custom-input-popup");
  if (existingPopup) existingPopup.remove();

  const selection = window.getSelection();
  if (!selection.rangeCount) return;

  const savedRange = selection.getRangeAt(0).cloneRange(); // ✅ Save selection to reuse later
  const savedRect = savedRange.getBoundingClientRect(); // ✅ Save this too

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();

  const bodyBg = window.getComputedStyle(document.body).backgroundColor;
  const isWhite = bodyBg === "rgb(255, 255, 255)" || bodyBg === "#ffffff";

  const popup = document.createElement("div");
  popup.id = "custom-input-popup";

  Object.assign(popup.style, {
    position: "absolute",
    top: `${window.scrollY + rect.bottom + 10}px`,
    left: `${Math.min(window.scrollX + rect.left, window.innerWidth - 250)}px`,
    backgroundColor: isWhite ? "#000" : "#fff",
    color: isWhite ? "#fff" : "#000",
    border: "1px solid #ccc",
    borderRadius: "6px",
    padding: "10px",
    boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
    zIndex: "9999",
    fontFamily: "inherit",
  });

  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Enter prompt...";
  Object.assign(input.style, {
    width: "20ch",
    height: "25px",
    fontSize: "20px",
    marginLeft: "10px",
    marginRight: "5px",
    transition: "width 0.2s ease",
  });

  const sendBtn = document.createElement("button");
  sendBtn.textContent = "Send";
  sendBtn.style.fontSize = "100%";
  sendBtn.style.marginRight = "5px";

  const cancelBtn = document.createElement("button");
  cancelBtn.textContent = "Cancel";
  cancelBtn.style.fontSize = "100%";
  cancelBtn.style.marginLeft = "10px";

  sendBtn.onclick = () => {
    const value = input.value.trim();
    if (value) {
      onSubmit(value, savedRange); // ✅ Send prompt with saved selection
      popup.remove(); // ✅ Remove input popup

      // 🔁 Step 1: Reselect the saved text after 1 second
      setTimeout(() => {
        const sel = window.getSelection();
        sel.removeAllRanges(); // ✅ Clear current selection (if any)
        sel.addRange(savedRange); // ✅ Restore original selection

        // ⏳ Step 2: Keep it selected for 3 seconds, then clear
        setTimeout(() => {
          sel.removeAllRanges(); // ✅ Clear the selection after 3 seconds
        }, 8000);
      }, 500);
    }
  };

  cancelBtn.onclick = () => {
    onCancel();
    popup.remove();
  };

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendBtn.click();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelBtn.click();
    }
  });

  popup.appendChild(input);
  popup.appendChild(sendBtn);
  popup.appendChild(cancelBtn);
  document.body.appendChild(popup);
  input.focus();
}

// Send prompt to background script
function sendToGemini(fullPrompt, onResponse) {
  chrome.runtime.sendMessage(
    {
      type: "gemini_request",
      prompt: fullPrompt,
    },
    (response) => {
      console.log("Gemini API response:", response);
      if (response.success) {
        renderApiResponseBelowSelection(response.output);
      } else {
        alert("Failed to get response from Gemini.");
      }
      if (onResponse) onResponse();
    }
  );
}

function captureSelectionStyles() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    console.warn("No selection to capture styles from.");
    return null;
  }

  const range = selection.getRangeAt(0);
  const container =
    range.startContainer.nodeType === Node.TEXT_NODE
      ? range.startContainer.parentNode
      : range.startContainer;

  const computedStyle = window.getComputedStyle(container);

  // Extract relevant style properties
  return {
    fontSize: computedStyle.fontSize,
    fontFamily: computedStyle.fontFamily,
    color: computedStyle.color,
    fontWeight: computedStyle.fontWeight,
    fontStyle: computedStyle.fontStyle,
    backgroundColor:
      window.getComputedStyle(document.body).backgroundColor || "#ffffff",
  };
}

// Render the Gemini response below selected text using DOM manipulation
// Text ke hisaab se previous responses track karne ke liye Map banaya
const responseAnchors = new Map();
function renderApiResponseBelowSelection(resultText, styleSnapshot) {
  // User ke selected text ko le rahe hain
  const selection = window.getSelection();

  // Agar selection nahi mila, to kuch bhi mat karo
  if (!selection || selection.rangeCount === 0) {
    console.warn("No selection found.");
    return;
  }

  // Selected text ko clean karke ek key bana rahe hain
  const selectedText = selection.toString().trim();
  const textKey = selectedText.toLowerCase(); // lowercase for uniformity

  // Response div banate hain jisme resultText dikhayenge
  const outputDiv = document.createElement("div");
  outputDiv.textContent = resultText;
  outputDiv.style.textDecoration = "none"; // underline hata diya

  // Agar koi styling snapshot mila hai to use apply karo
  if (styleSnapshot) {
    outputDiv.style.fontSize = styleSnapshot.fontSize;
    outputDiv.style.fontFamily = styleSnapshot.fontFamily;
    outputDiv.style.color = styleSnapshot.color;
    outputDiv.style.fontWeight = styleSnapshot.fontWeight;
    outputDiv.style.fontStyle = styleSnapshot.fontStyle;
    outputDiv.style.backgroundColor = styleSnapshot.backgroundColor;
    outputDiv.classList.add("gemini-response-box");
  }

  // Output box ka design set karte hain
  Object.assign(outputDiv.style, {
    border: "3px solid red", // Red border
    borderRadius: "10px", // Thoda rounded corners
    padding: "0.75em", // Andar ka gap
    whiteSpace: "pre-line", // Newlines preserve karne ke liye
    width: "100%", // Full width
    boxSizing: "border-box", // Padding ko width mein include karte hain
    marginTop: "1em", // Thoda gap upar se
    marginBottom: "10px", // Neeche bhi gap
  });

  // Agar humne pehle se anchor span store kiya hai to use wapas le lo
  if (responseAnchors.has(textKey)) {
    const lastAnchor = responseAnchors.get(textKey);
    // Last anchor ke just baad naye outputDiv ko insert karte hain
    lastAnchor.parentNode.insertBefore(outputDiv, lastAnchor.nextSibling);
    // Anchor ko update karte hain latest outputDiv se
    responseAnchors.set(textKey, outputDiv);
  } else {
    // Pehli baar hai to naya marker span banate hain jahan append karenge
    const range = selection.getRangeAt(0).cloneRange();
    const marker = document.createElement("span");
    marker.style.display = "block";
    marker.style.height = "0px"; // invisible marker
    marker.style.marginTop = "1em";

    range.collapse(false); // selection ke end pe le jaate hain
    range.insertNode(marker); // marker insert karte hain

    // Marker ke baad outputDiv ko insert karte hain
    marker.parentNode.insertBefore(outputDiv, marker.nextSibling);

    // Map mein pehli entry ke liye anchor store karte hain
    responseAnchors.set(textKey, outputDiv);
  }
}
