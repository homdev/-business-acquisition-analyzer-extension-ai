chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "analyze") {
    chrome.storage.local.get(['siteConfig'], (result) => {
      const siteConfig = result.siteConfig;
      if (siteConfig) {
        chrome.scripting.executeScript({
          target: { tabId: sender.tab.id },
          function: extractData,
          args: [siteConfig]
        }, (results) => {
          if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError.message);
            sendResponse({ error: chrome.runtime.lastError.message });
          } else {
            sendResponse({ data: results[0].result });
          }
        });
      } else {
        console.error('No site configuration found');
        sendResponse({ error: 'No site configuration found' });
      }
    });
    return true; // Indicate asynchronous response
  }
});

function extractData(siteConfig) {
  function getDtDdValue(label) {
    const dtElements = document.querySelectorAll('dl dt');
    for (let dt of dtElements) {
      if (dt.innerText.includes(label)) {
        const dd = dt.nextElementSibling;
        if (dd && dd.tagName === 'DD') {
          return dd.innerText.trim();
        }
      }
    }
    return null;
  }

  const selectors = {
    "transentreprise": {
      titleSelector: 'header h1.block-title',
      locationSelector: 'header h1.block-title small',
      priceSelector: 'Prix',
      revenueSelector: 'C.A.',
      employeesSelector: 'Effectif',
      descriptionSelector: '.text-annonce p'
    },
    "cessionpme": {
      // Définir les sélecteurs pour cessionpme
    }
    // Ajoutez des sélecteurs pour d'autres sites ici
  };

  const config = selectors[siteConfig.site];
  if (config) {
    const businessDetails = {
      title: document.querySelector(config.titleSelector)?.innerText,
      location: document.querySelector(config.locationSelector)?.innerText,
      price: getDtDdValue(config.priceSelector),
      revenue: getDtDdValue(config.revenueSelector),
      employees: getDtDdValue(config.employeesSelector),
      description: document.querySelector(config.descriptionSelector)?.innerText
    };
    console.log("Business details collected:", businessDetails);
    return businessDetails;
  } else {
    console.error('Configuration not found for site');
    return null;
  }
}
