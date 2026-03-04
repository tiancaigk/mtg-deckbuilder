-- MTG Deck Builder 数据库表结构
-- 在 Supabase SQL Editor 中运行

-- ============ 卡组表 ============
CREATE TABLE IF NOT EXISTS decks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  name TEXT NOT NULL DEFAULT '未命名卡组',
  main_deck JSONB NOT NULL DEFAULT '[]'::jsonb,
  sideboard JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引（加速查询）
CREATE INDEX IF NOT EXISTS idx_decks_user_id ON decks(user_id);
CREATE INDEX IF NOT EXISTS idx_decks_updated_at ON decks(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_decks_is_public ON decks(is_public);

-- ============ 行级安全（RLS） ============

-- 启用行级安全
ALTER TABLE decks ENABLE ROW LEVEL SECURITY;

-- 策略 1：用户可以查看自己的卡组
CREATE POLICY "Users can view their own decks"
  ON decks FOR SELECT
  USING (auth.uid() = user_id OR is_public = TRUE);

-- 策略 2：用户可以插入自己的卡组
CREATE POLICY "Users can insert their own decks"
  ON decks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 策略 3：用户可以更新自己的卡组
CREATE POLICY "Users can update their own decks"
  ON decks FOR UPDATE
  USING (auth.uid() = user_id);

-- 策略 4：用户可以删除自己的卡组
CREATE POLICY "Users can delete their own decks"
  ON decks FOR DELETE
  USING (auth.uid() = user_id);

-- ============ 完成提示 ============
SELECT '✅ 数据库表创建成功！' AS status;
