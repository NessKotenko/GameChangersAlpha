// Run globally on document_start
chrome.storage.local.get(['badLinks'], (result) => {
  const badLinks = result.badLinks || [];
  const currentUrl = window.location.href;

  // Check if current URL is in the bad links array
  // Strip trailing slashes or search queries to be safer
  const normalize = (url) => url.split('?')[0].replace(/\/$/, "");
  const normalizedCurrent = normalize(currentUrl);
  
  const isBlocked = badLinks.some(link => {
    return normalize(link) === normalizedCurrent;
  });

  if (isBlocked) {
    window.stop(); // Immediately stop the network/loading
    
    // Replace whole document payload 
    document.documentElement.innerHTML = `
      <head>
        <title>BLOCKED BY AI</title>
        <style>
          body {
            background-color: #8B0000;
            color: white;
            font-family: Arial, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            text-align: center;
          }
          .container {
            max-width: 600px;
            padding: 40px;
            background: rgba(255, 0, 0, 0.2);
            border: 5px solid red;
            border-radius: 12px;
            box-shadow: 0 0 20px rgba(0,0,0,0.5);
          }
          h1 { 
            font-size: 48px; 
            margin-bottom: 20px; 
            text-transform: uppercase; 
            text-shadow: 2px 2px 4px #000;
          }
          p { 
            font-size: 20px; 
            line-height: 1.5;
          }
          .warning {
            font-size: 80px;
            margin: 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="warning">🚨</div>
          <h1>DANGER: AI BLOCKED THIS LINK</h1>
          <p>This website was flagged as a phishing attempt, grooming, or malicious external link from a Discord chat.</p>
          <p><strong>Your safety has been protected. Close this tab immediately.</strong></p>
        </div>
      </body>
    `;
  }
});
