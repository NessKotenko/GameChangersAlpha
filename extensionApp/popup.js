document.addEventListener('DOMContentLoaded', () => {
  const saveBtn = document.getElementById('saveBtn');
  const codeInput = document.getElementById('kidCode');
  const status = document.getElementById('status');

  // Load existing code on open
  chrome.storage.local.get(['kidId'], (result) => {
    if (result.kidId) {
      codeInput.value = result.kidId;
      status.innerText = "Device Linked! ✅";
      status.style.color = "#3ba55c";
    }
  });

  saveBtn.addEventListener('click', () => {
    const code = codeInput.value.trim();
    if (code) {
      chrome.storage.local.set({ kidId: code }, () => {
        status.innerText = "Saved successfully! ✅";
        status.style.color = "#3ba55c";
      });
    } else {
      status.innerText = "Please enter a code.";
      status.style.color = "#ed4245";
    }
  });
});