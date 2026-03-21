const ackBtn = document.getElementById("ackBtn");
const helpBtn = document.getElementById("helpBtn");
const feedback = document.getElementById("actionFeedback");
const detectedAt = document.getElementById("detectedAt");
const statusBadge = document.getElementById("alertStatusBadge");
const toast = document.getElementById("incidentToast");
const parentAlertText = document.getElementById("parentAlertText");
const chatContainer = document.getElementById("chatContainer");
const currentIncidentType = document.getElementById("currentIncidentType");
const riskScore = document.getElementById("riskScore");
const attackerNameEl = document.getElementById("attackerName");
const aiReasonTextEl = document.getElementById("aiReasonText");

const riskByIncident = {
  "Harassment": "88/100",
  "Pedophilia": "97/100",
  "Physical Extortion": "94/100",
  "Verbal Abuse": "79/100",
  "Racism / Antisemitism": "84/100",
};

if (detectedAt) {
  detectedAt.textContent = new Date().toLocaleString();
}

if (toast) {
  setTimeout(() => {
    toast.classList.add("hidden");
  }, 6000);
}

function renderIncident(incidentType, reason, attackerName, childName, chatDuration, dynamicScore, richLogs) {
  const typeStr = incidentType || "Harassment";
  
  document.querySelectorAll('.incident-types .pill').forEach(pill => {
    if (pill.innerText === typeStr) {
      pill.classList.remove('outline');
      if (typeStr === 'Pedophilia' || typeStr === 'Physical Extortion') {
        pill.classList.add('destructive');
      } else {
        pill.classList.add('warning');
      }
    } else {
      pill.className = 'pill outline';
    }
  });

  if (currentIncidentType) currentIncidentType.textContent = typeStr;
  let dScore = parseInt(dynamicScore) || 100;
  if (dynamicScore !== undefined && riskScore) {
    riskScore.textContent = dScore + "/100";
  } else if (riskScore && riskByIncident[typeStr]) {
    riskScore.textContent = riskByIncident[typeStr];
  } else if (riskScore) {
    riskScore.textContent = "85/100";
  }

  const alertBox = parentAlertText;
  const headerTitle = document.querySelector(".content-main h2");

  if (dScore < 100 && dScore >= 60) {
    if (headerTitle) headerTitle.innerText = "⚠️ Suspicious Chat Review";
    if (alertBox) {
      alertBox.className = "alert-box";
      alertBox.style.backgroundColor = "rgba(245, 158, 11, 0.1)";
      alertBox.style.border = "1px solid #f59e0b";
      alertBox.style.color = "#d97706";
      alertBox.innerHTML = `<strong>Warning Investigation:</strong> Suspicious chat activity detected (Score: ${dScore}/100). Please review logs.`;
    }
  } else {
    if (headerTitle) headerTitle.innerText = "🚨 Illegitimate Chat Blocked";
    if (alertBox) {
      alertBox.className = "alert-box destructive";
      alertBox.style.backgroundColor = "";
      alertBox.style.border = "";
      alertBox.style.color = "";
      alertBox.innerHTML = `Your child experienced a critical incident classified as "${typeStr}".`;
    }
  }
  
  if (attackerNameEl) attackerNameEl.textContent = attackerName || "Unknown";
  if (aiReasonTextEl) aiReasonTextEl.textContent = reason || "No details provided.";

  let durationEl = document.getElementById("chatDurationDisplay");
  if (!durationEl) {
    durationEl = document.createElement("div");
    durationEl.id = "chatDurationDisplay";
    durationEl.className = "alert-box"; 
    durationEl.style.backgroundColor = "transparent";
    durationEl.style.border = "1px solid var(--border)";
    durationEl.style.marginBottom = "2rem";
    
    // Put it after the meta-grid
    const metaGrid = document.querySelector('.meta-grid');
    if (metaGrid && metaGrid.parentNode) {
      metaGrid.parentNode.insertBefore(durationEl, metaGrid.nextSibling);
    }
  }
  durationEl.innerHTML = `⏱️ <strong>Correspondence Duration:</strong> ${chatDuration || 'Unknown'}`;
  
  if (chatContainer && richLogs && richLogs.length) {
    chatContainer.innerHTML = "";
    
    richLogs.forEach(log => {
      let isAttacker = false;
      const tName = log.sender.toLowerCase();
      const aName = attackerName ? attackerName.toLowerCase() : "";
      
      if (aName && aName !== "unknown" && (tName.includes(aName) || aName.includes(tName) || tName.includes("app"))) {
        isAttacker = true;
      } else if (!aName || aName === "unknown") {
        isAttacker = true;
      }
      
      if (childName && childName !== "Unknown User" && log.sender === childName) {
        isAttacker = false;
      }

      const article = document.createElement("article");
      article.className = isAttacker ? "msg suspect" : "msg safe-user";
      
      const header = document.createElement("div");
      header.style.fontWeight = 'bold';
      header.style.marginBottom = '6px';
      header.style.fontSize = '13px';
      header.style.color = isAttacker ? 'var(--destructive)' : '#3ba55c';
      
      header.innerText = isAttacker ? `👿 Attacker (${log.sender})` : `🧒 Child (${log.sender})`;

      const p = document.createElement("pre");
      p.textContent = log.text;
      
      article.appendChild(header);
      article.appendChild(p);
      
      chatContainer.appendChild(article);
    });
  } else {
    if (chatContainer) {
      chatContainer.innerHTML = "<article class='msg suspect'><pre>No structured logs available.</pre></article>";
    }
  }

  let manualBtnOuter = document.getElementById("manualBlockBtnWrapper");
  if (!manualBtnOuter) {
     const actionsDiv = document.querySelector(".actions");
     if (actionsDiv) {
        const btnWrapper = document.createElement("div");
        btnWrapper.id = "manualBlockBtnWrapper";
        btnWrapper.style.marginLeft = "auto";
        
        const btn = document.createElement("button");
        btn.id = "manualBlockBtn";
        btn.className = "btn outline";
        btn.style.borderColor = "var(--destructive)";
        btn.style.color = "var(--destructive)";
        btn.innerHTML = "🚫 Explicitly Block Chat";
        btn.onclick = () => {
           chrome.storage.local.get(['badUsers'], (res) => {
              let users = res.badUsers || [];
              if (!users.includes(attackerName)) users.push(attackerName);
              chrome.storage.local.set({ badUsers: users, forceManualBlock: attackerName }, () => {
                 alert("Explicit Block Command sent. The Discord tab will lock now.");
                 btn.innerText = "🛑 Blocked by Parent";
                 btn.disabled = true;
                 btn.style.backgroundColor = "var(--destructive)";
                 btn.style.color = "white";
              });
           });
        };
        btnWrapper.appendChild(btn);
        actionsDiv.appendChild(btnWrapper);
     }
  }
}

chrome.storage.local.get(["lastIncident"], (result) => {
  if (result.lastIncident) {
    const { status, reason, attacker, childName, chatDuration, riskScore, richLogs } = result.lastIncident;
    renderIncident(status, reason, attacker, childName, chatDuration, riskScore, richLogs);
  } else {
    renderIncident("Harassment", "Automatically identified dangerous chat", "Unknown", "Unknown User", "Unknown", 85, []);
  }
});

if (ackBtn && feedback && statusBadge) {
  ackBtn.addEventListener("click", () => {
    feedback.textContent = "Alert marked as resolved. Continuing active monitoring.";
    feedback.className = "feedback safe-text";
    statusBadge.textContent = "Resolved";
    statusBadge.className = "status-badge safe";
  });
}

if (helpBtn && feedback) {
  helpBtn.addEventListener("click", () => {
    feedback.textContent = "Step 1: Verify participant identities. Step 2: Exit the chat.";
    feedback.className = "feedback text-muted";
  });
}
