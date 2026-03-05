/**
 * MTG Deck Builder - 工具函数
 */

// HTML 转义（防 XSS）
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 显示提示消息
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// 防抖函数
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// 解析法力费用
function parseManaCost(manaCost) {
  if (!manaCost) return ['C'];
  
  const symbols = manaCost.match(/{[^}]+}/g) || [];
  const colors = [];
  let generic = 0;

  symbols.forEach(symbol => {
    const color = symbol.replace(/[{}]/g, '');
    if (['W','U','B','R','G'].includes(color)) {
      colors.push(color);
    } else if (!isNaN(parseInt(color))) {
      generic += parseInt(color);
    } else if (color === 'C') {
      colors.push('C');
    } else if (color.length > 1 && color.includes('/')) {
      colors.push(color.split('/')[0]);
    }
  });

  if (generic > 0) {
    colors.unshift(generic.toString());
  }

  return colors.length > 0 ? colors : ['C'];
}

// 解析法术力值（CMC）
function parseCMC(manaCost) {
  if (!manaCost) return 0;
  
  const symbols = manaCost.match(/{[^}]+}/g) || [];
  let cmc = 0;

  symbols.forEach(symbol => {
    const value = symbol.replace(/[{}]/g, '');
    if (!isNaN(parseInt(value))) {
      cmc += parseInt(value);
    } else if (['W','U','B','R','G'].includes(value)) {
      cmc += 1;
    } else if (value === 'C') {
      cmc += 1;
    } else if (value.includes('/')) {
      cmc += 1;
    }
  });

  return cmc;
}

// 延迟函数
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

console.log('✅ Utils loaded');
