let currentPath = null;
let isChecking = false;
let lastMessageText = '';
let hasHistoryBeenScanned = false; 
let aiPaused = false; 
let isInitialScan = true;

function init() {
  injectStyles();
  
  const observer = new MutationObserver((mutations) => {
    if (window.location.pathname !== currentPath) {
      currentPath = window.location.pathname;
      isChecking = false;
      lastMessageText = '';
      hasHistoryBeenScanned = false;
      isInitialScan = true; 
      
      document.body.classList.remove('ai-chat-blocked');
      
      const overlay = document.getElementById('ai-main-overlay');
      if (overlay) overlay.remove();
      const safeBanner = document.querySelector('.ai-top-safe-banner');
      if (safeBanner) safeBanner.remove();
      
      const toast = document.getElementById('ai-parent-toast');
      if (toast) {
        if (aiPaused) {
          toast.innerHTML = '⏸️ <strong>AI Paused:</strong> Protection disabled for manual reply.';
          toast.style.background = '#f59e0b';
          toast.style.borderColor = '#f59e0b';
        } else {
          toast.innerHTML = '⏳ <strong>AI:</strong> Scanning chat history...';
          toast.style.background = 'rgba(43, 45, 49, 0.95)';
          toast.style.borderColor = 'rgba(255, 255, 255, 0.1)';
        }
      }

      if (!aiPaused) {
        // Scan history once
        setTimeout(() => {
          if (!hasHistoryBeenScanned && !isChecking && !aiPaused) {
            isChecking = true;
            hasHistoryBeenScanned = true;
            handleCheckClick();
          }
        }, 1500);
      }
    }

    if (isInitialScan && !aiPaused && hasHistoryBeenScanned === false) {
       applyPartnerBlur();
    }

    // Detect new messages in real-time
    const chatItems = document.querySelectorAll('[data-list-id="chat-messages"] li');
    if (chatItems.length > 0 && hasHistoryBeenScanned && !aiPaused) {
      const latestItem = chatItems[chatItems.length - 1];
      const latestText = extractCleanChat(latestItem) || latestItem.innerText.trim();
      
      if (latestText !== lastMessageText && latestText.length > 0) {
        lastMessageText = latestText;
        
        // Find author of newest message
        let msgAuthor = "Unknown";
        for (let i = chatItems.length - 1; i >= 0; i--) {
           const uNode = chatItems[i].querySelector('span[class^="username_"]');
           if (uNode) {
              msgAuthor = uNode.innerText.trim();
              break;
           }
        }
        
        const myName = getMyUsername();
        
        // Blur ONLY the newest message that triggered the scan, and only if it's the partner
        if (msgAuthor !== myName) {
          if (!latestItem.classList.contains('ai-checking-blur')) {
            latestItem.classList.add('ai-checking-blur');
          }
        }

        const toast = document.getElementById('ai-parent-toast');
        if (toast) {
          toast.innerHTML = '⏳ <strong>AI:</strong> Scanning new message...';
          toast.style.background = 'rgba(43, 45, 49, 0.95)';
          toast.style.borderColor = 'rgba(255, 255, 255, 0.1)';
        }
        
        // Wait for render then scan
        if (!isChecking) {
          isChecking = true;
          setTimeout(() => {
            if (!aiPaused) handleCheckClick();
          }, 1500);
        }
      }
    }

    injectBlacklistPanel();
    if (!aiPaused) injectParentToast();
  });
  
  observer.observe(document.body, { childList: true, subtree: true });

  // Remote Manual Block listener
  setInterval(() => {
    if (aiPaused) return;
    chrome.storage.local.get(['forceManualBlock'], (res) => {
      if (res.forceManualBlock) {
        const titleEl = document.querySelector('section h1');
        if (titleEl && titleEl.innerText.includes(res.forceManualBlock)) {
            chrome.storage.local.remove('forceManualBlock');
            triggerDangerBan("Harassment", "Manually blocked by Parent explicitly tracking incident.", titleEl.innerText, false, 100);
        }
      }
    });
  }, 2000);
}

function injectStyles() {
  if (document.getElementById('ai-dynamic-styles')) return;
  const style = document.createElement('style');
  style.id = 'ai-dynamic-styles';
  style.innerHTML = `
    .ai-checking-blur {
      filter: blur(10px) !important;
      pointer-events: none !important;
      user-select: none !important;
      opacity: 0.6;
      transition: all 0.3s ease;
    }
    body.ai-chat-blocked [class*="channelTextArea_"],
    body.ai-chat-blocked [class*="channelBottomBarArea_"],
    body.ai-chat-blocked [role="textbox"],
    body.ai-chat-blocked form {
      pointer-events: none !important;
      user-select: none !important;
      opacity: 0.3 !important;
      filter: grayscale(100%);
    }
  `;
  document.head.appendChild(style);
}

function loadAndRenderBlacklist() {
  const panel = document.getElementById('ai-blacklist-panel');
  if (!panel) return;
  const list = panel.querySelector('.ai-blacklist-list');
  if (!list) return;

  chrome.storage.local.get(['badUsers'], (result) => {
    const badUsers = result.badUsers || [];
    list.innerHTML = '';
    if (badUsers.length === 0) {
      list.innerHTML = '<li style="color:#80848e; font-style:italic; font-size:12px;">No blocked users yet</li>';
      return;
    }
    [...badUsers].reverse().forEach(user => {
      const li = document.createElement('li');
      li.innerText = '🚫 ' + user;
      list.appendChild(li);
    });
  });
}

function injectBlacklistPanel() {
  if (document.getElementById('ai-blacklist-panel')) return;
  const panel = document.createElement('div');
  panel.id = 'ai-blacklist-panel';
  panel.className = 'ai-blacklist-panel';
  
  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  header.style.alignItems = 'center';
  header.style.marginBottom = '8px';

  const title = document.createElement('div');
  title.className = 'ai-blacklist-title';
  title.innerText = '🛡️ Blocked Users';
  title.style.marginBottom = '0';
  
  const clearBtn = document.createElement('button');
  clearBtn.innerText = 'Clear & Pause AI';
  clearBtn.style.background = 'transparent';
  clearBtn.style.border = '1px solid #ed4245';
  clearBtn.style.color = '#ed4245';
  clearBtn.style.borderRadius = '4px';
  clearBtn.style.cursor = 'pointer';
  clearBtn.style.fontSize = '11px';
  clearBtn.style.padding = '2px 6px';
  clearBtn.title = 'Clear Blacklist and Pause Protection to reply manually';
  
  clearBtn.onclick = () => {
    aiPaused = true;
    chrome.storage.local.set({ badUsers: [], userWarnings: {} }, () => {
      loadAndRenderBlacklist();
      
      // Force Unblur and Unban
      isChecking = false;
      document.body.classList.remove('ai-chat-blocked');
      document.querySelectorAll('.ai-blurred-container').forEach(el => el.classList.remove('ai-blurred-container'));
      document.querySelectorAll('.ai-checking-blur').forEach(el => el.classList.remove('ai-checking-blur'));
      
      const overlay = document.getElementById('ai-main-overlay');
      if (overlay) overlay.remove();
      
      const toast = document.getElementById('ai-parent-toast');
      if (toast) {
        toast.innerHTML = '⏸️ <strong>AI Paused:</strong> Blacklist cleared. You may now reply. Reload page to re-enable.';
        toast.style.background = '#f59e0b';
        toast.style.borderColor = '#f59e0b';
      }
    });
  };

  header.appendChild(title);
  header.appendChild(clearBtn);

  const list = document.createElement('ul');
  list.className = 'ai-blacklist-list';
  
  panel.appendChild(header);
  panel.appendChild(list);
  document.body.appendChild(panel);
  
  loadAndRenderBlacklist();
}

function injectParentToast() {
  if (document.getElementById('ai-parent-toast')) return;
  const toast = document.createElement('div');
  toast.id = 'ai-parent-toast';
  toast.className = 'ai-parent-toast';
  toast.innerHTML = '👨‍👩‍👦 <strong>Parental Control:</strong> Monitoring chat...';
  document.body.appendChild(toast);
}

function handleCheckClick() {
  if (aiPaused) return;

  chrome.storage.local.get(['badUsers'], (result) => {
    const badUsers = result.badUsers || [];
    const titleEl = document.querySelector('section h1');
    const attackerUser = titleEl ? titleEl.innerText.trim() : null;

    if (attackerUser && badUsers.includes(attackerUser)) {
      triggerDangerBan("Harassment", "Permanently blocked by Parental Control.", attackerUser, false, 100);
      return; 
    }

    const chatItems = Array.from(document.querySelectorAll('[data-list-id="chat-messages"] li'));
    const recentItems = chatItems.slice(-30);
    const chatLogs = recentItems.map(extractCleanChat).filter(text => text !== null).join('\n');

    if (!chatLogs) {
      handleAIResponse({ status: 'safe', severity: 'safe', reason: 'Empty initialized chat room.' });
      return;
    }

    chrome.runtime.sendMessage({ action: "analyzeChat", chatLogs }, (response) => {
      if (chrome.runtime.lastError) {
        showError("🤖 Connection Error: " + chrome.runtime.lastError.message);
        return;
      }

      if (!response || !response.success) {
        showError("🤖 Error: " + (response && response.error ? response.error : "Unknown error"));
        return;
      }

      handleAIResponse(response.data);
    });
  });
}

function showError(msg) {
  isChecking = false;
  isInitialScan = false;
  document.querySelectorAll('.ai-checking-blur').forEach(el => el.classList.remove('ai-checking-blur'));
  const toast = document.getElementById('ai-parent-toast');
  if (toast) {
    toast.innerHTML = `⚠️ <strong>Error:</strong> ${msg}`;
    toast.style.background = '#ed4245';
  }
}

function handleAIResponse(data) {
  if (aiPaused) return;
  isChecking = false;
  isInitialScan = false;
  document.querySelectorAll('.ai-checking-blur').forEach(el => el.classList.remove('ai-checking-blur'));

  let riskScore = parseInt(data.riskScore);
  if (isNaN(riskScore)) riskScore = 0;
  
  const status = data.status || 'unknown';
  const reason = data.reason || 'No reason provided.';
  
  const titleEl = document.querySelector('section h1');
  const dangerUser = titleEl ? titleEl.innerText : 'Unknown Attacker';

  const toast = document.getElementById('ai-parent-toast');

  // If the score is 60 or higher, it is DANGEROUS. Lock it down permanently!
  if (riskScore >= 60) {
    triggerDangerBan(status, reason, dangerUser, false, riskScore);
  } 
  // If the score is 51-59, it's just mildly suspicious. Keep it visible but warn the kid.
  else if (riskScore > 50) {
    if (toast) {
      toast.innerHTML = `⚠️ <strong>Warning:</strong> Suspicious activity (Risk Score: ${riskScore}/100)...`;
      toast.style.background = 'rgba(245, 158, 11, 0.95)';
      toast.style.borderColor = '#f59e0b';
    }
  } 
  // If the score is 0-50, it is SAFE. Unblur it so the kid can chat!
  else {
    if (toast) {
      toast.innerHTML = `✅ <strong>Parental Control:</strong> Chat verified as safe. (Score: ${riskScore}/100)`;
      toast.style.background = 'rgba(59, 165, 92, 0.9)';
      toast.style.borderColor = '#3ba55c';
    }
    
    // Remove all remaining checking blurs so the chat is visible
    document.body.classList.remove('ai-chat-blocked');
    document.querySelectorAll('.ai-blurred-container').forEach(el => el.classList.remove('ai-blurred-container'));
  }
} 

function silentlyLogToDashboard(status, reason, dangerUser, riskScore) {
  const richLogs = scrapeRichChatLogs();
  const chatDuration = getChatDuration();
  
  chrome.storage.local.set({
    lastIncident: {
      status: status,
      reason: reason,
      attacker: dangerUser,
      childName: getMyUsername(),
      chatDuration: chatDuration,
      riskScore: riskScore,
      richLogs: richLogs
    }
  });
}

function triggerDangerBan(status, reason, dangerUser, isUpgraded, riskScore = 100) {
  document.body.classList.add('ai-chat-blocked');
  
  const container = document.querySelector('main [data-list-id="chat-messages"]');
  if (container) {
    if (!container.classList.contains('ai-blurred-container')) {
      container.classList.add('ai-blurred-container');
    }
    const parent = container.parentElement;
    parent.style.position = 'relative';
    
    let overlay = document.getElementById('ai-main-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'ai-center-overlay';
      overlay.id = 'ai-main-overlay';
      parent.appendChild(overlay);
    }
    
    overlay.style.backgroundColor = 'rgba(237, 66, 69, 0.95)';
    overlay.style.border = '1px solid #ed4245';
    overlay.style.boxShadow = '0 8px 32px rgba(237, 66, 69, 0.4)';
    
    const displayReason = isUpgraded ? "Repeated suspicious behavior escalated to Danger State." : reason;
    
    // REPLACED THE COUNTDOWN WITH STATIC TEXT
    overlay.innerHTML = `
      <div class="ai-overlay-text" style="color:white; text-align:center;">
        <span style="font-size:32px;">🛑</span><br>
        🚨 <strong>DANGER: ${status} [Score: ${riskScore}/100]</strong><br><br>
        <span style="font-size:14px; font-weight:normal;">${displayReason}</span><br><br>
        <span style="font-size:12px; color:#ffbaba;">you are safe.</span>
      </div>`;
  }
  
  const toast = document.getElementById('ai-parent-toast');
  if (toast) {
    toast.innerHTML = '🚨 <strong>Parental Control:</strong> Access Denied (Danger). Parents alerted.';
    toast.style.background = 'rgba(237, 66, 69, 0.9)';
    toast.style.borderColor = '#ed4245';
  }

  const richLogs = scrapeRichChatLogs();
  const chatDuration = getChatDuration();
  
  // Send data to the online database
  chrome.runtime.sendMessage({
    action: "reportIncident",
    data: {
      status: status,
      reason: reason,
      attacker: dangerUser,
      childName: getMyUsername(),
      chatDuration: chatDuration,
      riskScore: riskScore,
      richLogs: richLogs
    }
  });
  
  chrome.storage.local.get(['badUsers'], (result) => {
    let badUsers = result.badUsers || [];
    if (!badUsers.includes(dangerUser)) {
      badUsers.push(dangerUser);
    }
    chrome.storage.local.set({
      badUsers: badUsers,
      lastIncident: {
        status: status,
        reason: reason,
        attacker: dangerUser,
        childName: getMyUsername(),
        chatDuration: chatDuration,
        riskScore: riskScore,
        richLogs: richLogs
      }
    }, () => {
      loadAndRenderBlacklist();
      // NOTE: Removed the redirect setTimeout from here completely!
    });
  });
} 

function extractCleanChat(liNode) {
  const userNode = liNode.querySelector('span[class^="username_"]');
  const username = userNode ? userNode.innerText.trim() : '';

  const contentNode = liNode.querySelector('div[id^="message-content-"]');
  let content = contentNode ? contentNode.innerText.trim() : '';
  
  if (!content) {
    const attachmentNode = liNode.querySelector('a[href*="attachments"]');
    if (attachmentNode) content = '[Attachment/Image]';
  }

  if (!content) return null;

  if (username) return `${username}: ${content}`;
  return content;
}

function applyPartnerBlur() {
  const panels = document.querySelector('section[aria-label="User area"]');
  let myName = null;
  if (panels) {
    const nameDiv = panels.querySelector('div[class*="nameTag_"]');
    if (nameDiv) {
      myName = nameDiv.innerText.split('\\n')[0].trim();
    } else {
      myName = panels.innerText.split('\\n')[0].trim();
    }
  }

  const chatItems = document.querySelectorAll('[data-list-id="chat-messages"] li');
  let currentAuthor = null;

  chatItems.forEach(li => {
    if (li.className && typeof li.className === 'string' && li.className.includes('divider_')) return;

    const userNode = li.querySelector('span[class^="username_"]');
    if (userNode) {
      currentAuthor = userNode.innerText.trim();
    }
    
    // Fallback security: Blur if it's not explicitly My Username
    if (currentAuthor !== myName) {
      if (!li.classList.contains('ai-checking-blur')) {
        li.classList.add('ai-checking-blur');
      }
    }
  });
}

function getMyUsername() {
  const panels = document.querySelector('section[class^="panels_"]') || document.querySelector('div[class^="panels_"]');
  if (panels) {
    const nameDiv = panels.querySelector('div[class*="nameTag_"]') || panels.querySelector('div[class^="title_"]');
    if (nameDiv) return nameDiv.innerText.split('\\n')[0].trim();
    
    const lines = panels.innerText.split('\\n').filter(l => l.trim().length > 0);
    if (lines.length > 0) return lines[0].trim();
  }
  return "Unknown User";
}

function scrapeRichChatLogs() {
  const chatItems = Array.from(document.querySelectorAll('[data-list-id="chat-messages"] li'));
  const recentItems = chatItems.slice(-30);
  
  const richLogs = [];
  let currentSender = "Unknown";
  
  recentItems.forEach(li => {
    const userNode = li.querySelector('span[class^="username_"]');
    if (userNode) currentSender = userNode.innerText.trim();
    
    let timeRaw = null;
    const timeEl = li.querySelector('time');
    if (timeEl) timeRaw = timeEl.getAttribute('datetime');

    const contentNode = li.querySelector('div[id^="message-content-"]');
    let content = contentNode ? contentNode.innerText.trim() : '';
    if (!content) {
      const attachmentNode = liNode.querySelector('a[href*="attachments"]');
      if (attachmentNode) content = '[Attachment/Image]';
    }
    
    if (content) {
      richLogs.push({ sender: currentSender, text: content, timestamp: timeRaw });
    }
  });

  return richLogs;
}

function getChatDuration() {
  const times = Array.from(document.querySelectorAll('[data-list-id="chat-messages"] time'))
                     .map(t => new Date(t.getAttribute('datetime')).getTime())
                     .filter(n => !isNaN(n));
  if (times.length < 2) return "Less than a minute";
  
  const diffMs = times[times.length - 1] - times[0];
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return Array.of(days, " day(s), ", hours % 24, " hr(s)").join('');
  if (hours > 0) return Array.of(hours, " hour(s), ", minutes % 60, " min(s)").join('');
  if (minutes > 0) return Array.of(minutes, " min(s)").join('');
  return "Less than a minute";
}

// Start watching
init();
