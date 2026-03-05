/**
 * MTG Deck Builder - 卡牌搜索模块
 */

let currentSearchArea = 'main';

// 搜索卡牌
async function searchCards() {
  const query = document.getElementById('searchInput')?.value.trim();
  if (!query) return;

  const resultsDiv = document.getElementById('searchResults');
  if (!resultsDiv) return;

  resultsDiv.innerHTML = `
    <div class="loading">
      <div class="spinner"></div>
      <div>搜索中...</div>
    </div>
  `;

  try {
    const hasChinese = /[\u4e00-\u9fa5]/.test(query);
    let data;
    
    if (hasChinese) {
      data = await searchChinese(query);
    } else {
      data = await searchEnglish(query);
    }

    if (data.total_cards === 0 || (data.data && data.data.length === 0)) {
      resultsDiv.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🔍</div>
          <div class="empty-state-text">未找到卡牌</div>
        </div>
      `;
      return;
    }

    displaySearchResults(data.data || []);
  } catch (error) {
    console.error('搜索失败:', error);
    resultsDiv.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">❌</div>
        <div class="empty-state-text">搜索失败，请重试</div>
      </div>
    `;
  }
}

// 中文搜索
async function searchChinese(query) {
  console.log('🔍 中文搜索（优先中文版）');
  const response = await fetch(
    `https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}+lang:cs&unique=prints&order=set`
  );
  let data = await response.json();
  
  // 结果较少时补充搜索所有版本
  if (data.total_cards < 5) {
    console.log('🔍 结果较少，补充搜索所有版本');
    const allResponse = await fetch(
      `https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}&unique=prints&order=set`
    );
    const allData = await allResponse.json();
    
    if (allData.total_cards > 0) {
      const existingIds = new Set(data.data.map(c => c.id));
      const newCards = allData.data.filter(c => !existingIds.has(c.id));
      data.data = [...data.data, ...newCards];
      data.total_cards = data.data.length;
    }
  }
  
  // Fuzzy 匹配
  if (data.total_cards === 0) {
    console.log('🔍 尝试 fuzzy 匹配');
    const response = await fetch(
      `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(query)}`
    );
    if (response.ok) {
      const card = await response.json();
      data = { total_cards: 1, data: [card] };
    }
  }
  
  return data;
}

// 英文搜索
async function searchEnglish(query) {
  console.log('🔍 英文搜索');
  const response = await fetch(
    `https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}&unique=prints&order=set`
  );
  let data = await response.json();
  
  if (data.total_cards === 0) {
    console.log('🔍 尝试 fuzzy 匹配');
    const response = await fetch(
      `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(query)}`
    );
    if (response.ok) {
      const card = await response.json();
      data = { total_cards: 1, data: [card] };
    }
  }
  
  return data;
}

// 显示搜索结果
function displaySearchResults(cards) {
  const resultsDiv = document.getElementById('searchResults');
  
  if (cards.length === 0) {
    resultsDiv.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔍</div>
        <div class="empty-state-text">未找到卡牌</div>
      </div>
    `;
    return;
  }

  resultsDiv.innerHTML = cards.map(card => {
    const displayName = escapeHtml(card.printed_name || card.name);
    const displayType = escapeHtml(card.printed_type_line || card.type_line);
    const imageUrl = card.image_uris?.normal || 
                    card.card_faces?.[0]?.image_uris?.normal || 
                    card.image_uris?.small ||
                    'https://cards.scryfall.io/back.jpg';
    
    const manaCost = parseManaCost(card.mana_cost);
    return `
      <div class="card-item">
        <img class="card-image" src="${imageUrl}" alt="${displayName}" loading="lazy" onclick="event.stopPropagation()">
        <div class="card-details">
          <div class="card-name">${displayName}</div>
          <div class="card-type">${displayType}</div>
          <div class="card-mana">
            ${manaCost.map(m => `<div class="mana-symbol mana-${m.toLowerCase()}">${m}</div>`).join('')}
          </div>
        </div>
        <div style="display: flex; flex-direction: column; gap: 0.25rem;">
          <button class="add-btn" onclick="window.mtgDeck.addToDeck('${card.id}', '${displayName.replace(/'/g, "\\'")}', 'main')">+ 主牌</button>
          <button class="add-btn" onclick="window.mtgDeck.addToDeck('${card.id}', '${displayName.replace(/'/g, "\\'")}', 'side')" style="background: var(--warning); font-size: 0.75rem; padding: 0.375rem 0.75rem;">+ 备牌</button>
        </div>
      </div>
    `;
  }).join('');
}

// 设置颜色筛选
function setupColorFilters() {
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
    });
  });
}

// 回车搜索
function setupSearchEnterKey() {
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        searchCards();
      }
    });
  }
}

// 导出到全局
window.mtgSearch = {
  searchCards,
  searchChinese,
  searchEnglish,
  displaySearchResults,
  setupColorFilters,
  setupSearchEnterKey
};

console.log('✅ Search module loaded');
