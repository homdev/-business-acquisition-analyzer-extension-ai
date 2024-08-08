document.getElementById('analyzeBtn').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    function: analyzePage,
  }, async (result) => {
    const data = result[0]?.result;
    console.log("Données extraites de la page:", data);

    if (!data || !data.title || !data.location || !data.price || !data.revenue || !data.employees || !data.description) {
      console.error("Erreur : Données extraites invalides ou incomplètes");
      document.getElementById('result').innerText = 'Erreur lors de l\'extraction des données de la page. Certaines données sont manquantes.';
      return;
    }

    document.getElementById('placeholder-image').style.display = 'block';
    document.getElementById('scoreChart').style.display = 'none';

    try {
      console.log('Envoi des données au serveur:', JSON.stringify(data));
      const response = await fetch('http://localhost:3000/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      console.log('Réponse reçue du serveur:', response);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error('La réponse du réseau n\'était pas correcte: ' + response.statusText + ' - ' + errorText);
      }

      const resultData = await response.json();
      console.log("Réponse de l'API:", resultData);

      if (resultData && resultData.score !== undefined && resultData.explanation) {
        if (typeof Chart !== 'undefined') {
          setTimeout(() => updateScoreChart(resultData.score), 0);
        } else {
          console.error("Chart.js n'est pas chargé");
        }

        document.getElementById('placeholder-image').style.display = 'none';
        document.getElementById('scoreChart').style.display = 'block';

        document.getElementById('explanation').innerHTML = `
          <p><strong>Note du potentiel commercial : ${resultData.score}/100</strong></p>
          <p><strong>Explication :</strong></p>
          <p>${sanitizeExplanation(resultData.explanation)}</p>
        `;

        storeAnalysis({ ...data, score: resultData.score, explanation: resultData.explanation });
      } else {
        throw new Error("Données de réponse invalides de l'API.");
      }
    } catch (error) {
      console.error('Erreur:', error);
      document.getElementById('result').innerText = 'Erreur lors de l\'analyse de l\'entreprise: ' + error.message;
    }
  });
});

function analyzePage() {
  const siteConfigs = {
    "www.transentreprise.com": "transentreprise",
    "www.cessionpme.com": "cessionpme",
  };

  const hostname = window.location.hostname;
  const site = siteConfigs[hostname];

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

  if (site) {
    const businessDetails = {
      site: site, 
      title: document.querySelector('header h1.block-title')?.innerText,
      location: document.querySelector('header h1.block-title small')?.innerText,
      price: getDtDdValue('Prix'),
      revenue: getDtDdValue('C.A.'),
      employees: getDtDdValue('Effectif'),
      description: document.querySelector('.text-annonce p')?.innerText
    };
    console.log("Business details collected:", businessDetails);
    return businessDetails;
  } else {
    console.error('Site not supported');
    return null;
  }
}

function sanitizeExplanation(explanation) {
  return explanation.replace(/\*\*/g, '').replace(/###\s/g, '').replace(/(?:\r\n|\r|\n)/g, '<br>');
}

function getScoreColor(score) {
  if (score >= 75) {
    return '#4CAF50';
  } else if (score >= 50) {
    return '#FFA500';
  } else {
    return '#FF0000';
  }
}

function updateScoreChart(score) {
  const ctx = document.getElementById('scoreChart').getContext('2d');
  const scoreColor = getScoreColor(score);
  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Score', 'Restant'],
      datasets: [{
        data: [score, 100 - score],
        backgroundColor: [scoreColor, '#e0e0e0'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      cutout: '70%',
      plugins: {
        tooltip: {
          enabled: false
        },
        legend: {
          display: false
        },
        title: {
          display: true,
          text: 'Note du potentiel commercial',
          font: {
            size: 16
          }
        }
      }
    }
  });
}

function storeAnalysis(analysis) {
  chrome.storage.local.get(['analyses'], function(result) {
    const analyses = result.analyses || [];
    analyses.push(analysis);
    chrome.storage.local.set({ analyses: analyses }, function() {
      console.log('Analyse sauvegardée.');
      updateComparison(analyses);
      updateEvolution(analyses);
    });
  });
}

document.addEventListener('DOMContentLoaded', function() {
  chrome.storage.local.get(['analyses'], function(result) {
    const analyses = result.analyses || [];
    const historyElement = document.getElementById('history');
    analyses.forEach((analysis, index) => {
      const scoreColor = getScoreColor(analysis.score);
      const analysisDiv = document.createElement('div');
      analysisDiv.innerHTML = `
        <button class="accordion" style="background-color: ${scoreColor}; box-shadow: 0 4px 8px rgba(0,0,0,0.2); border: 1px solid ${scoreColor};">Analyse ${index + 1}: <b>${analysis.title}</b> </button>
        <div class="panel">
          <p><strong>Titre :</strong> ${analysis.title}</p>
          <p><strong>Localisation :</strong> ${analysis.location}</p>
          <p><strong>Prix :</strong> ${analysis.price}</p>
          <p><strong>Chiffre d'affaires :</strong> ${analysis.revenue}</p>
          <p><strong>Employés :</strong> ${analysis.employees}</p>
          <p><strong>Description :</strong> ${analysis.description}</p>
          <p><strong>Note du potentiel commercial :</strong> ${analysis.score}/100</p>
          <p><strong>Explication :</strong></p>
          <p>${sanitizeExplanation(analysis.explanation)}</p>
        </div>
      `;
      historyElement.appendChild(analysisDiv);
    });

    const acc = document.getElementsByClassName("accordion");
    for (let i = 0; i < acc.length; i++) {
      acc[i].addEventListener("click", function() {
        this.classList.toggle("active");
        const panel = this.nextElementSibling;
        if (panel.style.display === "block") {
          panel.style.display = "none";
        } else {
          panel.style.display = "block";
        }
      });
    }

    updateComparison(analyses);
    updateEvolution(analyses);
  });
});

function updateComparison(analyses) {
  const comparisonElement = document.getElementById('comparison');
  comparisonElement.innerHTML = '';
  const ctx = document.createElement('canvas');
  comparisonElement.appendChild(ctx);

  const labels = analyses.map((analysis, index) => `Analyse ${index + 1}`);
  const scores = analyses.map(analysis => analysis.score);

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Score du potentiel commercial',
        data: scores,
        backgroundColor: scores.map(score => getScoreColor(score)),
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: 'Comparaison des scores du potentiel commercial'
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100
        }
      }
    }
  });
}

function updateEvolution(analyses) {
  const evolutionElement = document.getElementById('evolution');
  evolutionElement.innerHTML = '';
  const ctx = document.createElement('canvas');
  evolutionElement.appendChild(ctx);

  const labels = analyses.map((analysis, index) => `Analyse ${index + 1}`);
  const scores = analyses.map(analysis => analysis.score);

  new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Score du potentiel commercial',
        data: scores,
        borderColor: 'rgba(75, 192, 192, 1)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        fill: false,
        tension: 0.1
      }]
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: 'Évolution des scores du potentiel commercial'
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100
        }
      }
    }
  });
}
