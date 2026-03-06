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
    // 检测是否为系列 + 编号格式（如 "BIG 36"）
    const setNumberMatch = parseSetNumber(query);
    let data;
    
    if (setNumberMatch) {
      // 系列编号精确搜索
      data = await searchSetNumber(setNumberMatch.set, setNumberMatch.number);
    } else {
      // 检测是否为"卡名 + 系列"组合搜索（如 "莲花瓣 mb1" 或 "mb1 莲花瓣"）
      const cardWithSetMatch = parseCardWithSet(query);
      
      if (cardWithSetMatch) {
        // 卡名 + 系列组合搜索
        data = await searchCardWithSet(cardWithSetMatch.cardName, cardWithSetMatch.setCode);
      } else {
        const hasChinese = /[\u4e00-\u9fa5]/.test(query);
        
        if (hasChinese) {
          data = await searchChinese(query);
        } else {
          data = await searchEnglish(query);
        }
      }
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

// 解析系列 + 编号格式（如 "BIG 36"）
function parseSetNumber(query) {
  const match = query.match(/^([A-Za-z0-9]+)\s+(\d+)$/);
  if (match) {
    return { set: match[1].toLowerCase(), number: match[2] };
  }
  return null;
}

// 系列 + 编号精确搜索
async function searchSetNumber(setCode, collectorNumber) {
  console.log(`🔍 系列编号搜索：${setCode.toUpperCase()} ${collectorNumber}`);
  const response = await fetch(
    `https://api.scryfall.com/cards/search?q=e:${setCode}+cn:${collectorNumber}&unique=prints`
  );
  return await response.json();
}

// 解析"卡名 + 系列"组合搜索（如 "莲花瓣 mb1" 或 "mb1 莲花瓣"）
function parseCardWithSet(query) {
  // 常见系列代码正则（3-4 位字母数字）
  const setCodePattern = /\b([A-Z]{2,4}|[A-Z]{1,3}\d{1,2})\b/i;
  
  // 尝试匹配系列代码
  const setMatch = query.match(setCodePattern);
  if (!setMatch) return null;
  
  const setCode = setMatch[1].toLowerCase();
  // 移除系列代码，剩下的作为卡名
  const cardName = query.replace(setCodePattern, '').trim();
  
  // 卡名不能为空
  if (!cardName) return null;
  
  console.log(`🔍 解析组合搜索：卡名="${cardName}" 系列="${setCode.toUpperCase()}"`);
  return { cardName, setCode };
}

// 卡名 + 系列组合搜索
async function searchCardWithSet(cardName, setCode) {
  console.log(`🔍 组合搜索：${cardName} + set:${setCode.toUpperCase()}`);
  
  const hasChinese = /[\u4e00-\u9fa5]/.test(cardName);
  let searchQuery;
  
  if (hasChinese) {
    // 中文卡名 + 系列 - 先搜索所有版本再过滤
    console.log('🔍 中文 + 系列搜索（先搜索后过滤）');
    const response = await fetch(
      `https://api.scryfall.com/cards/search?q=${encodeURIComponent(cardName)}&unique=prints&order=set`
    );
    let data = await response.json();
    
    // 过滤出目标系列的版本
    if (data.data && data.data.length > 0) {
      const filtered = data.data.filter(c => c.set?.toLowerCase() === setCode);
      data.data = filtered;
      data.total_cards = filtered.length;
    }
    return data;
  } else {
    // 英文卡名 + 系列 - 使用 Scryfall 语法
    searchQuery = `!"${cardName}" set:${setCode}`;
    console.log('🔍 英文 + 系列精确搜索');
    
    const response = await fetch(
      `https://api.scryfall.com/cards/search?q=${encodeURIComponent(searchQuery)}&unique=prints`
    );
    return await response.json();
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
    const largeImageUrl = card.image_uris?.large || card.image_uris?.normal || imageUrl;
    
    const manaCost = parseManaCost(card.mana_cost);
    return `
      <div class="card-item">
        <img class="card-image" src="${imageUrl}" alt="${displayName}" loading="lazy" 
             onclick="window.mtgSearch.toggleCardPreview('${largeImageUrl}')"
             style="cursor: zoom-in;">
        <div class="card-details">
          <div class="card-name">${displayName}</div>
          <div class="card-type">${displayType}</div>
          <div class="card-mana">
            ${manaCost.map(m => `<div class="mana-symbol mana-${m.toLowerCase()}">${m}</div>`).join('')}
          </div>
        </div>
        <div style="display: flex; flex-direction: column; gap: 0.25rem;">
          <button class="add-btn" onclick="event.stopPropagation(); window.mtgDeck.addToDeck('${card.id}', '${displayName.replace(/'/g, "\\'")}', 'main')">+ 主牌</button>
          <button class="add-btn" onclick="event.stopPropagation(); window.mtgDeck.addToDeck('${card.id}', '${displayName.replace(/'/g, "\\'")}', 'side')" style="background: var(--warning); font-size: 0.75rem; padding: 0.375rem 0.75rem;">+ 备牌</button>
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

// 初始化卡牌预览
document.addEventListener('DOMContentLoaded', () => {
  setupCardPreview();
});

// 切换卡牌大图预览（点击显示/隐藏）
let isPreviewShowing = false;

function toggleCardPreview(imageUrl) {
  if (isPreviewShowing) {
    hideCardPreview();
  } else {
    showCardPreview(imageUrl);
  }
}

function showCardPreview(imageUrl) {
  const preview = document.getElementById('cardPreview');
  const backdrop = document.getElementById('cardPreviewBackdrop');
  
  if (preview && backdrop) {
    preview.src = imageUrl;
    preview.classList.add('show');
    backdrop.classList.add('show');
    isPreviewShowing = true;
  }
}

function hideCardPreview() {
  const preview = document.getElementById('cardPreview');
  const backdrop = document.getElementById('cardPreviewBackdrop');
  
  if (preview && backdrop) {
    preview.classList.remove('show');
    backdrop.classList.remove('show');
    isPreviewShowing = false;
  }
}

// 设置卡牌预览事件
function setupCardPreview() {
  const backdrop = document.getElementById('cardPreviewBackdrop');
  const preview = document.getElementById('cardPreview');
  
  if (backdrop) {
    backdrop.addEventListener('click', toggleCardPreview);
  }
  
  if (preview) {
    preview.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }
  
  // ESC 键关闭
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hideCardPreview();
    }
  });
}

// 导出到全局
window.mtgSearch = {
  searchCards,
  searchChinese,
  searchEnglish,
  searchCardWithSet,
  parseCardWithSet,
  displaySearchResults,
  setupColorFilters,
  setupSearchEnterKey,
  showCardPreview,
  hideCardPreview,
  toggleCardPreview,
  setupCardPreview
};

console.log('✅ Search module loaded (with card+set search)');
