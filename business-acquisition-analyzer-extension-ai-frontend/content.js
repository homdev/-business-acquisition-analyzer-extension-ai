chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "analyze") {
    chrome.storage.local.get(['siteConfig'], (result) => {
      const siteConfig = result.siteConfig;
      if (siteConfig) {
        const selectors = {
          "transentreprise": {
            titleSelector: 'header h1.block-title',
            locationSelector: 'header h1.block-title small',
            priceSelector: 'dt:contains("Prix") + dd',
            revenueSelector: 'dt:contains("C.A.") + dd',
            employeesSelector: 'dt:contains("Effectif") + dd',
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
          sendResponse({ data: businessDetails });
        } else {
          console.error('Configuration not found for site');
          sendResponse({ error: 'Configuration not found for site' });
        }
      } else {
        console.error('No site configuration found');
        sendResponse({ error: 'No site configuration found' });
      }
    });
    return true; // Indicate asynchronous response
  }
});
