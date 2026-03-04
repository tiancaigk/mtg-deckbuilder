# MTG Deck Builder 部署说明

## 🌐 部署到 Vercel（推荐）

### 方法 1：Vercel 官网（最简单）

1. **访问** https://vercel.com/new
2. **导入 Git 仓库**
   - 选择 `tiancaigk/mtg-deckbuilder`
   - 或者上传 `index.html` 文件
3. **点击 Deploy**
4. **完成！** 获得链接如 `https://mtg-deckbuilder.vercel.app`

### 方法 2：Vercel CLI

```bash
# 登录 Vercel
vercel login

# 部署
cd /Users/yuanjun/.openclaw/workspace/mtg-deckbuilder
vercel --prod
```

---

## 📦 部署到 GitHub Pages

### 步骤

1. **创建 GitHub 仓库**
   - 访问 https://github.com/new
   - 仓库名：`mtg-deckbuilder`
   - 公开/私有 都可以

2. **推送代码**
```bash
cd /Users/yuanjun/.openclaw/workspace/mtg-deckbuilder
git remote add origin https://github.com/tiancaigk/mtg-deckbuilder.git
git push -u origin main
```

3. **启用 GitHub Pages**
   - Settings → Pages
   - Source: Deploy from branch
   - Branch: main
   - Folder: / (root)
   - Save

4. **等待 1-2 分钟**

5. **访问** `https://tiancaigk.github.io/mtg-deckbuilder/`

---

## 🎯 推荐方案

**Vercel 官网部署** 最简单！

不需要命令行，直接上传文件即可：
1. 访问 https://vercel.com/new
2. 上传 `index.html`
3. 完成！

---

## 📱 手机访问

部署完成后，手机可以访问：
- Vercel: `https://mtg-deckbuilder.vercel.app`
- GitHub: `https://tiancaigk.github.io/mtg-deckbuilder/`

---

*更新时间：2026-03-04*
