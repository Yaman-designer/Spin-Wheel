let helpData = {};

async function loadHelpData() {
    try {
        const res = await fetch("/help/api/topics/");
        if (!res.ok) {
            console.error("Help topics could not be loaded. Server error:", res.status, res.statusText);
            return;
        }
        const json = await res.json();
        const map = {};
        (json.results || []).forEach(item => {
            map[item.slug] = { title: item.title, content: item.content };
        });
        helpData = map;
    } catch (error) {
        console.error("An error occurred while processing help topics.", error);
    }
}

function openHelpSearchModal() {
  const modal = new bootstrap.Modal(document.getElementById('helpSearchModal'));
  modal.show();
  const modalInput = document.getElementById('helpSearchInput');

  document.getElementById('helpSearchModal').addEventListener('shown.bs.modal', () => {
    modalInput.focus();
  }, { once: true });

  modalInput.value = "";
  if(document.getElementById("helpSearchResults")) {
    document.getElementById("helpSearchResults").innerHTML = "";
  }
}

async function performHelpSearch() {
    const query = document.getElementById("helpSearchInput").value.trim().toLowerCase();
    const resultsContainer = document.getElementById("helpSearchResults");

    if (!resultsContainer) return;

    if (query.length < 2) {
        resultsContainer.innerHTML = "";
        return;
    }

    try {
        const res = await fetch(`/help/search/?q=${encodeURIComponent(query)}`);
        if (!res.ok) {
            resultsContainer.innerHTML = `<li class="list-group-item text-muted">Search failed</li>`;
            return;
        }
        const data = await res.json();
        displayResults(data.results || [], query);
    } catch (e) {
        resultsContainer.innerHTML = `<li class="list-group-item text-muted">Search error</li>`;
    }
}

function displayResults(results, query) {
    const resultsContainer = document.getElementById("helpSearchResults");
    if (!resultsContainer) return;

    if (results.length === 0) {
        resultsContainer.innerHTML = `<li class="list-group-item text-muted">"${query}" not found</li>`;
    } else {
        resultsContainer.innerHTML = results
            .filter(r => r.slug && r.title) // Sadece slug ve title'ı olan sonuçları göster
            .map(r => `
              <li class="list-group-item list-group-item-action" onclick="location.href='/help/${r.slug}/';">
                <strong>${r.title}</strong>
                <span class="text-muted small d-block mt-1">${r.snippet || ''}</span>
              </li>
            `).join('');
    }
}

function getSnippet(content, keywords) { // Changed 'keyword' to 'keywords' (an array)
    if (!keywords || keywords.length === 0) {
        return content.length > 150 ? content.substring(0, 150) + "..." : content;
    }

    const lowerContent = content.toLowerCase();
    let snippetStart = -1; // To find the best starting point for the snippet

    // Find the first occurrence of any keyword to determine the snippet's center
    for (const keyword of keywords) {
        let term1 = keyword;
        let term2 = keyword.endsWith('s') ? keyword.slice(0, -1) : keyword + 's';

        let index = lowerContent.indexOf(term1);
        if (index === -1) {
            index = lowerContent.indexOf(term2);
        }
        if (index !== -1) {
            snippetStart = index;
            break; // Found a keyword, so we can set the snippet start
        }
    }

    // If no keywords are found, return a default snippet
    if (snippetStart === -1) {
        return content.length > 150 ? content.substring(0, 150) + "..." : content;
    }

    const start = Math.max(0, snippetStart - 60);
    const end = Math.min(content.length, start + 180);
    let snippet = content.substring(start, end);

    // Create a regex to highlight all keywords and their plural/singular forms
    const highlightTerms = keywords.flatMap(keyword => {
        const terms = [keyword];
        if (keyword.endsWith('s')) {
            terms.push(keyword.slice(0, -1));
        } else {
            terms.push(keyword + 's');
        }
        return terms;
    }).filter(term => term.length > 0) // Ensure no empty terms
      .map(term => `\\b${term}\\b`); // Add word boundaries

    if (highlightTerms.length > 0) {
        const highlightRegex = new RegExp(`(${highlightTerms.join('|')})`, 'gi');
        snippet = snippet.replace(highlightRegex, (match) => `<b>${match}</b>`);
    }


    if (start > 0) snippet = "..." + snippet;
    if (end < content.length) snippet = snippet + "...";

    return snippet.replace(/\n/g, ' ');
}
