/**
 * MTG Deck Builder - 卡组核心逻辑模块
 */

// 卡组数据
let deck = {
  name: '',
  main: [],
  side: []
};

let currentArea = 'main';
let currentSelectedCard = null;
let currentSelectedArea = null;
let saveDebounceTimer = null;
let currentCurrency = 'USD'; // 'USD' or 'CNY'
let exchangeRate = 7.25; // 默认汇率，会动态获取

// ============ 卡组基础操作 ============

function addToDeck(cardId, cardName, area = 'main') {
  fetch(`https://api.scryfall.com/cards/${cardId}`)
    .then(res => res.json())
    .then(card => {
      const targetDeck = area === 'main' ? deck.main : deck.side;
      const existing = targetDeck.find(c => c.id === cardId);
      
      const isBasicLand = card.type_line && card.type_line.includes('Basic Land');
      const maxQuantity = isBasicLand ? 99 : 4;
      const price = parseFloat(card.prices?.usd || card.prices?.usd_foil || card.prices?.eur || '0') || 0;
      
      if (existing) {
        if (existing.quantity < maxQuantity) {
          existing.quantity++;
          showToast(`已添加第 ${existing.quantity} 张 ${card.name} 到${area === 'main' ? '主牌' : '备牌'}`, 'success');
        } else {
          showToast(isBasicLand ? '已达到最大数量' : '最多只能放 4 张同名卡', 'error');
          return;
        }
      } else {
        if (area === 'side') {
          const sideTotal = deck.side.reduce((sum, c) => sum + c.quantity, 0);
          if (sideTotal >= 15) {
            showToast('备牌已达 15 张上限', 'error');
            return;
          }
        }
        
        targetDeck.push({
          id: card.id,
          name: card.name,
          type_line: card.type_line,
          mana_cost: card.mana_cost,
          image_uris: card.image_uris,
          quantity: 1,
          price: price,
          set: card.set,
          set_name: card.set_name,
          collector_number: card.collector_number,
          foil: false
        });
        showToast(`已添加 ${card.name} 到${area === 'main' ? '主牌' : '备牌'}`, 'success');
      }

      updateDeckUI();
      debouncedSave();
    })
    .catch(err => {
      console.error('添加失败:', err);
      showToast('添加失败', 'error');
    });
}

function changeQuantity(cardId, delta, area) {
  event.stopPropagation();
  const targetDeck = area === 'main' ? deck.main : deck.side;
  const cardIndex = targetDeck.findIndex(c => c.id === cardId);
  
  if (cardIndex === -1) return;
  
  const card = targetDeck[cardIndex];
  const isBasicLand = card.type_line && card.type_line.includes('Basic Land');
  const maxQuantity = isBasicLand ? 99 : 4;
  
  card.quantity += delta;
  
  if (card.quantity <= 0) {
    targetDeck.splice(cardIndex, 1);
  } else if (card.quantity > maxQuantity) {
    card.quantity = maxQuantity;
    showToast(isBasicLand ? '基本地最多 99 张' : '最多只能放 4 张同名卡', 'error');
  }
  
  updateDeckUI();
  debouncedSave();
}

async function toggleFoil(cardId, area) {
  event.stopPropagation();
  const targetDeck = area === 'main' ? deck.main : deck.side;
  const card = targetDeck.find(c => c.id === cardId);
  
  if (!card) return;
  
  card.foil = !card.foil;
  const isFoil = card.foil;
  
  try {
    const response = await fetch(`https://api.scryfall.com/cards/${cardId}`);
    const versionData = await response.json();
    
    const hasFoil = versionData.foil;
    const hasNonFoil = versionData.nonfoil;
    
    if ((isFoil && !hasFoil) || (!isFoil && !hasNonFoil)) {
      card.foil = !isFoil;
      showToast(`此版本没有${isFoil ? 'Foil' : 'Non-foil'}`, 'error');
      updateDeckUI();
      return;
    }
    
    const price = isFoil 
      ? (parseFloat(versionData.prices?.usd_foil || '0') || 0)
      : (parseFloat(versionData.prices?.usd || '0') || 0);
    card.price = price;
    
    updateDeckUI();
    debouncedSave();
    showToast(`已切换到${isFoil ? ' Foil' : ' Non-foil'}`, 'success');
  } catch (error) {
    console.error('切换 Foil 失败:', error);
    card.foil = !isFoil;
    updateDeckUI();
    showToast('切换失败', 'error');
  }
}

function clearDeck() {
  if (confirm('确定要清空主牌和备牌吗？')) {
    deck.main = [];
    deck.side = [];
    deck.name = '';
    updateDeckNameDisplay();
    updateDeckUI();
    debouncedSave();
    showToast('卡组已清空', 'success');
  }
}

// ============ UI 更新 ============

function updateDeckUI() {
  if (!Array.isArray(deck.main)) deck.main = [];
  if (!Array.isArray(deck.side)) deck.side = [];

  // 主牌分类
  const mainCreatures = deck.main.filter(c => c.type_line && c.type_line.includes('Creature'));
  const mainSpells = deck.main.filter(c => c.type_line && !c.type_line.includes('Creature') && !c.type_line.includes('Land'));
  const mainLands = deck.main.filter(c => c.type_line && c.type_line.includes('Land'));

  document.getElementById('mainCreaturesList').innerHTML = renderDeckList(mainCreatures, 'main');
  document.getElementById('mainSpellsList').innerHTML = renderDeckList(mainSpells, 'main');
  document.getElementById('mainLandsList').innerHTML = renderDeckList(mainLands, 'main');

  document.getElementById('mainCreatureCount').textContent = mainCreatures.reduce((sum, c) => sum + c.quantity, 0);
  document.getElementById('mainSpellCount').textContent = mainSpells.reduce((sum, c) => sum + c.quantity, 0);
  document.getElementById('mainLandCount').textContent = mainLands.reduce((sum, c) => sum + c.quantity, 0);

  const mainTotal = deck.main.reduce((sum, c) => sum + c.quantity, 0);
  document.getElementById('mainCount').textContent = mainTotal;
  document.getElementById('mainTotalCount').textContent = mainTotal;

  const mainCountEl = document.getElementById('mainTotalCount');
  mainCountEl.className = 'deck-area-count';
  if (mainTotal < 60) mainCountEl.classList.add('warning');
  else mainCountEl.classList.add('success');

  const headerCountEl = document.getElementById('mainCount');
  headerCountEl.className = 'deck-stat-value';
  if (mainTotal < 60) headerCountEl.classList.add('warning');
  else headerCountEl.classList.add('success');

  // 备牌分类
  const sideCreatures = deck.side.filter(c => c.type_line && c.type_line.includes('Creature'));
  const sideSpells = deck.side.filter(c => c.type_line && !c.type_line.includes('Creature') && !c.type_line.includes('Land'));
  const sideLands = deck.side.filter(c => c.type_line && c.type_line.includes('Land'));

  document.getElementById('sideCreaturesList').innerHTML = renderDeckList(sideCreatures, 'side');
  document.getElementById('sideSpellsList').innerHTML = renderDeckList(sideSpells, 'side');
  document.getElementById('sideLandsList').innerHTML = renderDeckList(sideLands, 'side');

  document.getElementById('sideCreatureCount').textContent = sideCreatures.reduce((sum, c) => sum + c.quantity, 0);
  document.getElementById('sideSpellCount').textContent = sideSpells.reduce((sum, c) => sum + c.quantity, 0);
  document.getElementById('sideLandCount').textContent = sideLands.reduce((sum, c) => sum + c.quantity, 0);

  const sideTotal = deck.side.reduce((sum, c) => sum + c.quantity, 0);
  document.getElementById('sideCount').textContent = sideTotal;
  document.getElementById('sideTotalCount').textContent = sideTotal;

  const sideCountEl = document.getElementById('sideTotalCount');
  sideCountEl.className = 'deck-area-count sideboard';
  if (sideTotal > 15) {
    sideCountEl.classList.add('error');
  }

  const sideHeaderEl = document.getElementById('sideCount');
  sideHeaderEl.className = 'deck-stat-value';
  if (sideTotal > 15) sideHeaderEl.classList.add('error');
  else if (sideTotal === 15) sideHeaderEl.classList.add('success');
  else sideHeaderEl.classList.add('warning');

  // 价格
  const mainPrice = deck.main.reduce((sum, c) => sum + (c.price || 0) * c.quantity, 0);
  const sidePrice = deck.side.reduce((sum, c) => sum + (c.price || 0) * c.quantity, 0);
  const totalPrice = mainPrice + sidePrice;
  
  if (currentCurrency === 'USD') {
    document.getElementById('totalPrice').textContent = `$${totalPrice.toFixed(2)}`;
  } else {
    const cnyPrice = totalPrice * exchangeRate;
    document.getElementById('totalPrice').textContent = `¥${cnyPrice.toFixed(2)}`;
  }

  updateManaCurve('main');
  updateColorDistribution('main');
  updateColorDistribution('side');
}

function renderDeckList(cards, area) {
  if (cards.length === 0) {
    return '<div class="empty-state" style="padding: 1rem;"><small>暂无卡牌</small></div>';
  }

  return cards.map(card => {
    const cardTotal = (card.price || 0) * card.quantity;
    const isFoil = card.foil || false;
    const thumbnailUrl = card.image_uris?.art_crop || card.image_uris?.small || 'https://cards.scryfall.io/back.jpg';
    const escapedName = escapeHtml(card.name);
    
    return `
      <div class="deck-card">
        <div class="deck-card-info">
          <div class="deck-card-quantity-row">
            <div class="deck-card-quantity">${card.quantity}</div>
            <div class="deck-card-qty-buttons">
              <button class="deck-card-qty-btn" onclick="window.mtgDeck.changeQuantity('${card.id}', -1, '${area}')">−</button>
              <button class="deck-card-qty-btn" onclick="window.mtgDeck.changeQuantity('${card.id}', 1, '${area}')">+</button>
            </div>
          </div>
          <img class="deck-card-thumbnail" src="${thumbnailUrl}" alt="${escapedName}" onclick="window.mtgDeck.showVersionSelector('${card.id}', '${escapedName}', '${area}')">
          <div class="deck-card-name-wrapper">
            <div class="deck-card-name">
              <span onclick="window.mtgDeck.showVersionSelector('${card.id}', '${escapedName}', '${area}')">${escapedName}</span>
            </div>
            ${card.set || card.collector_number ? `<div class="deck-card-set-info">${card.set ? card.set.toUpperCase() : ''}${card.set && card.collector_number ? ' • ' : ''}${card.collector_number || ''}</div>` : ''}
            ${card.price > 0 ? `<div class="deck-card-price">$${card.price.toFixed(2)} × ${card.quantity} = $${cardTotal.toFixed(2)}</div>` : ''}
          </div>
        </div>
        <div class="deck-card-actions-wrapper">
          <span class="deck-card-foil-label ${isFoil ? 'foil' : 'nonfoil'}">${isFoil ? '✨ Foil' : '⚪ Non-foil'}</span>
          <button class="qty-btn" onclick="window.mtgDeck.toggleFoil('${card.id}', '${area}')" title="切换 Foil/Non-foil">🔄</button>
        </div>
      </div>
    `;
  }).join('');
}

function updateManaCurve(area) {
  const targetDeck = area === 'main' ? (deck.main || []) : (deck.side || []);
  const curve = [0, 0, 0, 0, 0, 0, 0];

  targetDeck.forEach(card => {
    const cmc = parseCMC(card.mana_cost);
    const index = Math.min(cmc, 6);
    curve[index] += card.quantity;
  });

  const max = Math.max(...curve);
  const chart = document.getElementById(`${area}ManaCurve`);
  
  if (!chart) return;
  
  chart.innerHTML = curve.map((count, i) => {
    const height = max > 0 ? (count / max) * 80 : 4;
    return `
      <div class="curve-bar" style="height: ${height}px;">
        <div class="curve-label">${i === 6 ? '6+' : i}</div>
      </div>
    `;
  }).join('');
}

function updateColorDistribution(area) {
  const targetDeck = area === 'main' ? (deck.main || []) : (deck.side || []);
  const colors = { W: 0, U: 0, B: 0, R: 0, G: 0 };

  targetDeck.forEach(card => {
    if (!card.mana_cost) return;
    
    const symbols = card.mana_cost.match(/{[^}]+}/g) || [];
    symbols.forEach(symbol => {
      const color = symbol.replace(/[{}]/g, '');
      if (['W','U','B','R','G'].includes(color)) {
        colors[color] += card.quantity;
      }
    });
  });

  const distribution = document.getElementById(`${area}ColorDistribution`);
  if (!distribution) return;

  distribution.innerHTML = Object.entries(colors)
    .filter(([_, count]) => count > 0)
    .map(([color, count]) => `
      <div class="color-pip ${color.toLowerCase()}">
        ${color}
        <div class="color-count">${count}</div>
      </div>
    `).join('');
}

function toggleSection(id) {
  const section = document.getElementById(id);
  if (section) {
    section.style.display = section.style.display === 'none' ? 'block' : 'none';
  }
}

function updateDeckNameDisplay() {
  const display = document.getElementById('deckNameDisplay');
  if (display) {
    display.textContent = deck.name || '';
  }
}

// ============ 存储 ============

function debouncedSave() {
  if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
  saveDebounceTimer = setTimeout(() => {
    localStorage.setItem('mtg-deck', JSON.stringify(deck));
  }, 500);
}

function loadDeck() {
  const saved = localStorage.getItem('mtg-deck');
  if (saved) {
    try {
      const loaded = JSON.parse(saved);
      deck = {
        name: loaded.name || '',
        main: Array.isArray(loaded.main) ? loaded.main : [],
        side: Array.isArray(loaded.side) ? loaded.side : []
      };
      return true;
    } catch (e) {
      console.error('加载存档失败:', e);
      deck = { name: '', main: [], side: [] };
      return false;
    }
  }
  return false;
}

// ============ 卡组管理 ============

function showDeckManager() {
  const modal = document.getElementById('deckManagerModal');
  if (modal) {
    modal.style.display = 'flex';
    const nameInput = document.getElementById('deckNameInput');
    if (nameInput) nameInput.value = deck.name || '';
    renderSavedDecks();
  }
}

function closeDeckManager() {
  const modal = document.getElementById('deckManagerModal');
  if (modal) modal.style.display = 'none';
}

function getSavedDecks() {
  const saved = localStorage.getItem('mtg-saved-decks');
  return saved ? JSON.parse(saved) : {};
}

function renderSavedDecks() {
  const list = document.getElementById('savedDecksList');
  const savedDecks = getSavedDecks();
  const deckNames = Object.keys(savedDecks);

  if (deckNames.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📁</div>
        <div class="empty-state-text">暂无保存的卡组</div>
      </div>
    `;
    return;
  }

  list.innerHTML = deckNames.map(name => {
    const d = savedDecks[name];
    const mainCount = d.main.reduce((sum, c) => sum + c.quantity, 0);
    const sideCount = d.side.reduce((sum, c) => sum + c.quantity, 0);
    const date = new Date(d.updatedAt).toLocaleString('zh-CN', { 
      month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' 
    });

    return `
      <div class="saved-deck-item" onclick="window.mtgDeck.loadSavedDeck('${name}')">
        <div class="saved-deck-info">
          <div class="saved-deck-name">${escapeHtml(name)}</div>
          <div class="saved-deck-meta">主牌 ${mainCount} 张 · 备牌 ${sideCount} 张 · ${date}</div>
        </div>
        <div class="saved-deck-actions">
          <button class="saved-deck-btn" onclick="event.stopPropagation(); window.mtgDeck.renameDeck('${name}')" title="重命名">✏️</button>
          <button class="saved-deck-btn delete" onclick="event.stopPropagation(); window.mtgDeck.deleteDeck('${name}')" title="删除">🗑️</button>
        </div>
      </div>
    `;
  }).join('');
}

function saveCurrentDeck() {
  const name = document.getElementById('deckNameInput')?.value.trim();
  if (!name) {
    showToast('请输入卡组名称', 'error');
    return;
  }

  if (deck.main.length === 0 && deck.side.length === 0) {
    showToast('卡组是空的', 'error');
    return;
  }

  // 检查是否已有同名卡组
  const savedDecks = getSavedDecks();
  if (savedDecks[name]) {
    const oldDeck = savedDecks[name];
    const oldMainCount = oldDeck.main.reduce((sum, c) => sum + c.quantity, 0);
    const oldSideCount = oldDeck.side.reduce((sum, c) => sum + c.quantity, 0);
    const newMainCount = deck.main.reduce((sum, c) => sum + c.quantity, 0);
    const newSideCount = deck.side.reduce((sum, c) => sum + c.quantity, 0);
    const date = new Date(oldDeck.updatedAt).toLocaleString('zh-CN', { 
      month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' 
    });
    
    const confirmMsg = `⚠️ 发现同名卡组 "${name}"\n\n旧版本：\n- 主牌 ${oldMainCount} 张\n- 备牌 ${oldSideCount} 张\n- 保存时间：${date}\n\n新版本：\n- 主牌 ${newMainCount} 张\n- 备牌 ${newSideCount} 张\n\n确定要覆盖吗？`;
    
    if (!confirm(confirmMsg)) {
      return; // 用户取消覆盖
    }
  }

  deck.name = name;
  updateDeckNameDisplay();

  const timestamp = new Date().toISOString();
  
  savedDecks[name] = {
    ...deck,
    updatedAt: timestamp
  };

  localStorage.setItem('mtg-saved-decks', JSON.stringify(savedDecks));
  showToast(`卡组 "${name}" 已保存`, 'success');
  renderSavedDecks();
}

function loadSavedDeck(name) {
  const savedDecks = getSavedDecks();
  if (!savedDecks[name]) {
    showToast('卡组不存在', 'error');
    return;
  }

  const d = savedDecks[name];
  deck = {
    name: name,
    main: d.main || [],
    side: d.side || []
  };

  updateDeckNameDisplay();
  updateDeckUI();
  debouncedSave();
  closeDeckManager();
  showToast(`已加载卡组 "${name}"`, 'success');
}

function renameDeck(oldName) {
  const newName = prompt('输入新名称:', oldName);
  if (!newName || newName === oldName) return;

  const savedDecks = getSavedDecks();
  if (savedDecks[oldName]) {
    savedDecks[newName] = savedDecks[oldName];
    savedDecks[newName].updatedAt = new Date().toISOString();
    delete savedDecks[oldName];
    localStorage.setItem('mtg-saved-decks', JSON.stringify(savedDecks));
    
    if (deck.name === oldName) {
      deck.name = newName;
      updateDeckNameDisplay();
      debouncedSave();
    }
    
    showToast(`已重命名为 "${newName}"`, 'success');
    renderSavedDecks();
  }
}

function deleteDeck(name) {
  if (!confirm(`确定要删除卡组 "${name}" 吗？`)) return;

  const savedDecks = getSavedDecks();
  delete savedDecks[name];
  localStorage.setItem('mtg-saved-decks', JSON.stringify(savedDecks));
  
  showToast(`已删除卡组 "${name}"`, 'success');
  renderSavedDecks();
}

// ============ 导入/导出 ============

function showImportModal() {
  const modal = document.getElementById('importModal');
  if (modal) {
    modal.style.display = 'flex';
    const textarea = document.getElementById('importText');
    const status = document.getElementById('importStatus');
    if (textarea) textarea.value = '';
    if (status) status.style.display = 'none';
  }
}

function closeImportModal() {
  const modal = document.getElementById('importModal');
  if (modal) modal.style.display = 'none';
}

async function importDeck() {
  const text = document.getElementById('importText')?.value.trim();
  if (!text) {
    showToast('请输入卡组列表', 'error');
    return;
  }

  try {
    let mainText = '', sideText = '';
    const sideboardIndex = text.toLowerCase().indexOf('sideboard');
    if (sideboardIndex >= 0) {
      mainText = text.substring(0, sideboardIndex).trim();
      sideText = text.substring(sideboardIndex + 9).trim();
    } else {
      mainText = text;
    }

    const mainCards = parseDeckList(mainText);
    const sideCards = parseDeckList(sideText);

    if (mainCards.length === 0 && sideCards.length === 0) {
      showToast('未找到有效的卡牌格式', 'error');
      return;
    }

    const statusDiv = document.getElementById('importStatus');
    const progressDiv = document.getElementById('importProgress');
    if (statusDiv) statusDiv.style.display = 'block';
    
    const totalCards = mainCards.length + sideCards.length;
    let imported = 0, failed = 0, failedCards = [];

    for (const card of mainCards) {
      if (progressDiv) progressDiv.textContent = `正在搜索主牌：${card.name} (${imported + 1}/${totalCards})`;
      const success = await importCard(card, 'main');
      if (success) imported++;
      else { failed++; failedCards.push(card.name); }
      if (imported % 5 === 0) await delay(200);
    }

    for (const card of sideCards) {
      if (progressDiv) progressDiv.textContent = `正在搜索备牌：${card.name} (${imported + 1}/${totalCards})`;
      const success = await importCard(card, 'side');
      if (success) imported++;
      else { failed++; failedCards.push(card.name); }
      if (imported % 5 === 0) await delay(200);
    }

    updateDeckUI();
    debouncedSave();

    setTimeout(() => {
      closeImportModal();
      showToast(`成功导入 ${imported} 张卡牌！${failed > 0 ? ` (${failed} 张失败)` : ''}`, failed > 0 ? 'warning' : 'success');
    }, 1500);
  } catch (error) {
    console.error('导入错误:', error);
    showToast('导入失败：' + error.message, 'error');
  }
}

function parseDeckList(text) {
  const lines = text.split('\n').filter(line => line.trim());
  const cards = [];

  lines.forEach(line => {
    const match = line.match(/^(\d+)\s*[xX×]?\s*(.+)$/);
    if (match) {
      const quantity = parseInt(match[1]);
      const name = match[2].trim();
      if (quantity > 0 && name) {
        cards.push({ quantity, name });
      }
    }
  });

  return cards;
}

async function importCard(card, area) {
  try {
    let response = await fetch(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(card.name)}`);
    let data = await response.json();

    if (data.object === 'error') {
      response = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(card.name)}&unique=prints`);
      const searchData = await response.json();
      if (searchData.data && searchData.data.length > 0) {
        data = searchData.data[0];
      }
    }

    if (data.object === 'card') {
      const targetDeck = area === 'main' ? deck.main : deck.side;
      const existing = targetDeck.find(c => c.id === data.id);
      const isBasicLand = data.type_line && data.type_line.includes('Basic Land');
      const maxQuantity = isBasicLand ? 99 : 4;
      const price = parseFloat(data.prices?.usd || data.prices?.usd_foil || data.prices?.eur || '0') || 0;
      
      if (existing) {
        existing.quantity = Math.min(existing.quantity + card.quantity, maxQuantity);
      } else {
        targetDeck.push({
          id: data.id,
          name: data.name,
          type_line: data.type_line,
          mana_cost: data.mana_cost,
          image_uris: data.image_uris,
          quantity: Math.min(card.quantity, maxQuantity),
          price: price,
          set: data.set,
          set_name: data.set_name,
          collector_number: data.collector_number,
          foil: false
        });
      }
      return true;
    }
  } catch (error) {
    console.error('导入失败:', card.name, error);
  }
  return false;
}

function exportDeck() {
  if (deck.main.length === 0 && deck.side.length === 0) {
    showToast('卡组是空的', 'error');
    return;
  }

  let text = `${deck.name || '未命名卡组'}\n\n`;
  text += `=== Main Deck ===\n`;
  text += deck.main.map(c => `${c.quantity} ${c.name}`).join('\n');
  
  if (deck.side.length > 0) {
    text += `\n\n=== Sideboard ===\n`;
    text += deck.side.map(c => `${c.quantity} ${c.name}`).join('\n');
  }
  
  copyToClipboard(text).then(() => {
    showToast('卡组已复制到剪贴板！', 'success');
  });
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }
}

// ============ 版本选择器 ============

async function showVersionSelector(cardId, cardName, area) {
  currentSelectedCard = cardId;
  currentSelectedArea = area;
  
  if (!cardId || cardId === 'undefined' || cardId === 'null') {
    showToast('卡牌 ID 无效，请重新添加此卡', 'error');
    return;
  }
  
  const modal = document.getElementById('versionModal');
  const title = document.getElementById('versionModalTitle');
  const grid = document.getElementById('versionsGrid');
  const loading = document.getElementById('versionModalLoading');
  
  if (title) title.textContent = `选择版本：${cardName}`;
  if (modal) modal.style.display = 'flex';
  if (grid) grid.innerHTML = '';
  if (loading) loading.style.display = 'block';

  try {
    const response = await fetch(`https://api.scryfall.com/cards/${cardId}`);
    const card = await response.json();

    if (card.object === 'error') {
      if (grid) grid.innerHTML = `<div class="empty-state"><div class="empty-state-icon">❌</div><div class="empty-state-text">卡牌数据无效</div></div>`;
    } else if (card.prints_search_uri) {
      const printsResponse = await fetch(card.prints_search_uri);
      const printsData = await printsResponse.json();
      displayVersions(printsData.data || []);
    } else {
      displayVersions([card]);
    }
  } catch (error) {
    console.error('获取版本失败:', error);
    if (grid) grid.innerHTML = `<div class="empty-state"><div class="empty-state-icon">❌</div><div class="empty-state-text">加载失败</div></div>`;
  }

  if (loading) loading.style.display = 'none';
}

function displayVersions(versions) {
  const grid = document.getElementById('versionsGrid');
  if (!grid || versions.length === 0) return;
  
  const currentCard = deck[currentSelectedArea === 'main' ? 'main' : 'side']?.find(c => c.id === currentSelectedCard);
  const currentIsFoil = currentCard?.foil || false;
  const hasFoil = versions.some(v => v.foil);
  const hasNonFoil = versions.some(v => v.nonfoil);
  const currentVersion = versions.find(v => v.id === currentSelectedCard) || versions[0];
  const foilPrice = parseFloat(currentVersion.prices?.usd_foil || '0') || 0;
  const nonFoilPrice = parseFloat(currentVersion.prices?.usd || '0') || 0;

  let foilOptions = '';
  if (hasFoil || hasNonFoil) {
    foilOptions = `
      <div class="foil-toggle">
        <div class="foil-option ${!currentIsFoil && hasNonFoil ? 'active' : ''} ${!hasNonFoil ? 'disabled' : ''}" 
             onclick="${hasNonFoil ? 'window.mtgDeck.setFoil(false)' : ''}">
          <div class="foil-option-label">⚪ Non-foil</div>
          <div class="foil-option-price">${hasNonFoil ? (nonFoilPrice > 0 ? '$' + nonFoilPrice.toFixed(2) : '暂无价格') : '此版本无 Non-foil'}</div>
        </div>
        <div class="foil-option ${currentIsFoil && hasFoil ? 'active' : ''} ${!hasFoil ? 'disabled' : ''}" 
             onclick="${hasFoil ? 'window.mtgDeck.setFoil(true)' : ''}">
          <div class="foil-option-label">✨ Foil</div>
          <div class="foil-option-price">${hasFoil ? (foilPrice > 0 ? '$' + foilPrice.toFixed(2) : '暂无价格') : '此版本无 Foil'}</div>
        </div>
      </div>
    `;
  }

  grid.innerHTML = foilOptions + versions.map(version => {
    const price = currentIsFoil 
      ? (parseFloat(version.prices?.usd_foil || '0') || 0)
      : (parseFloat(version.prices?.usd || '0') || 0);
    const isSelected = version.id === currentSelectedCard;
    const rarityMap = { common: 'common', uncommon: 'uncommon', rare: 'rare', mythic: 'mythic', 'basic land': 'common' };
    const rarityClass = rarityMap[version.rarity] || 'common';

    return `
      <div class="version-card ${isSelected ? 'selected' : ''}" onclick="window.mtgDeck.selectVersion('${version.id}')">
        <img class="version-image" src="${version.image_uris?.normal || 'https://cards.scryfall.io/back.jpg'}" alt="${version.name}">
        <div class="version-set">${version.set_name} (${version.set.toUpperCase()})</div>
        <div class="version-rarity rarity-${rarityClass}">${version.rarity}</div>
        <div class="version-price">${price > 0 ? '$' + price.toFixed(2) : '暂无价格'}</div>
        ${isSelected ? '<div style="color: var(--secondary); font-size: 0.75rem; margin-top: 0.5rem;">✅ 当前版本</div>' : ''}
      </div>
    `;
  }).join('');
}

function setFoil(isFoil) {
  const targetDeck = currentSelectedArea === 'main' ? deck.main : deck.side;
  const card = targetDeck.find(c => c.id === currentSelectedCard);
  if (!card) return;

  fetch(`https://api.scryfall.com/cards/${card.id}`)
    .then(res => res.json())
    .then(versionData => {
      const hasFoil = versionData.foil;
      const hasNonFoil = versionData.nonfoil;

      if ((isFoil && !hasFoil) || (!isFoil && !hasNonFoil)) {
        showToast(`此版本没有${isFoil ? 'Foil' : 'Non-foil'}`, 'error');
        return;
      }

      card.foil = isFoil;
      const price = isFoil 
        ? (parseFloat(versionData.prices?.usd_foil || '0') || 0)
        : (parseFloat(versionData.prices?.usd || '0') || 0);
      card.price = price;

      updateDeckUI();
      debouncedSave();
      showToast(`已切换到${isFoil ? ' Foil' : ' Non-foil'}`, 'success');
      
      fetch(`https://api.scryfall.com/cards/${currentSelectedCard}`)
        .then(res => res.json())
        .then(card => {
          if (card.prints_search_uri) {
            fetch(card.prints_search_uri)
              .then(res => res.json())
              .then(prints => displayVersions(prints.data || []));
          }
        });
    })
    .catch(err => {
      console.error('切换 Foil 失败:', err);
      showToast('切换失败', 'error');
    });
}

function selectVersion(newCardId) {
  if (newCardId === currentSelectedCard) {
    closeVersionModal();
    return;
  }

  fetch(`https://api.scryfall.com/cards/${newCardId}`)
    .then(res => res.json())
    .then(newCard => {
      if (newCard.object !== 'card') {
        showToast('获取卡牌失败', 'error');
        return;
      }

      const targetDeck = currentSelectedArea === 'main' ? deck.main : deck.side;
      const cardIndex = targetDeck.findIndex(c => c.id === currentSelectedCard);
      
      if (cardIndex >= 0) {
        const oldCard = targetDeck[cardIndex];
        const price = parseFloat(newCard.prices?.usd || newCard.prices?.usd_foil || newCard.prices?.eur || '0') || 0;
        
        targetDeck[cardIndex] = {
          ...oldCard,
          id: newCard.id,
          name: newCard.name,
          image_uris: newCard.image_uris,
          price: price,
          set: newCard.set,
          set_name: newCard.set_name,
          collector_number: newCard.collector_number
        };

        updateDeckUI();
        debouncedSave();
        showToast(`已切换到 ${newCard.set_name} 版本`, 'success');
        closeVersionModal();
      }
    })
    .catch(err => {
      console.error('切换版本失败:', err);
      showToast('切换失败', 'error');
    });
}

function closeVersionModal() {
  const modal = document.getElementById('versionModal');
  if (modal) modal.style.display = 'none';
  currentSelectedCard = null;
  currentSelectedArea = null;
}

// ============ 初始化 ============

function init() {
  // 加载保存的货币设置
  const savedCurrency = localStorage.getItem('mtg-currency');
  if (savedCurrency) {
    currentCurrency = savedCurrency;
    const btn = document.querySelector('.currency-toggle');
    if (btn) {
      btn.textContent = currentCurrency === 'USD' ? '💱' : '💲';
      btn.title = currentCurrency === 'USD' ? '切换到人民币' : '切换到美元';
    }
  }
  
  loadDeck();
  fetchExchangeRate(); // 获取实时汇率
  updateDeckUI();
  updateDeckNameDisplay();
  
  // 弹窗外部关闭
  document.getElementById('importModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'importModal') closeImportModal();
  });
  
  document.getElementById('versionModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'versionModal') closeVersionModal();
  });
  
  document.getElementById('deckManagerModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'deckManagerModal') closeDeckManager();
  });
  
  console.log('✅ Deck module initialized');
}

// 导出到全局
window.mtgDeck = {
  addToDeck,
  changeQuantity,
  toggleFoil,
  clearDeck,
  updateDeckUI,
  renderDeckList,
  updateManaCurve,
  updateColorDistribution,
  toggleSection,
  updateDeckNameDisplay,
  debouncedSave,
  loadDeck,
  showDeckManager,
  closeDeckManager,
  getSavedDecks,
  renderSavedDecks,
  saveCurrentDeck,
  loadSavedDeck,
  renameDeck,
  deleteDeck,
  showImportModal,
  closeImportModal,
  importDeck,
  parseDeckList,
  importCard,
  exportDeck,
  copyToClipboard,
  showVersionSelector,
  displayVersions,
  setFoil,
  selectVersion,
  closeVersionModal,
  init,
  toggleCurrency,
  fetchExchangeRate
};

// ============ 货币切换功能 ============

function toggleCurrency() {
  currentCurrency = currentCurrency === 'USD' ? 'CNY' : 'USD';
  updateDeckUI();
  localStorage.setItem('mtg-currency', currentCurrency);
  
  const btn = document.querySelector('.currency-toggle');
  if (btn) {
    btn.textContent = currentCurrency === 'USD' ? '💱' : '💲';
    btn.title = currentCurrency === 'USD' ? '切换到人民币' : '切换到美元';
  }
}

async function fetchExchangeRate() {
  try {
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
    const data = await response.json();
    exchangeRate = data.rates.CNY || 7.25;
    console.log('💱 汇率更新:', exchangeRate);
    updateDeckUI();
  } catch (error) {
    console.error('获取汇率失败:', error);
    exchangeRate = 7.25; // 使用默认汇率
  }
}

console.log('✅ Deck module loaded');
