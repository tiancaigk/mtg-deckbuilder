// MTG Deck Builder - Supabase 客户端配置

const SUPABASE_URL = 'https://ufbkztfwerksdkkgwocv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmYmt6dGZ3ZXJrc2Rra2d3b2N2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2MjEzNDcsImV4cCI6MjA4ODE5NzM0N30.a1IfkTa69JHxvAFn8bOSduzdiudDtP8Uz3MFcpp1KRQ';

// 初始化 Supabase 客户端
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

// 用户认证函数
async function signUp(email, password) {
  const { data, error } = await supabaseClient.auth.signUp({ email, password });
  if (error) {
    console.error('注册失败:', error);
    return { success: false, error: error.message };
  }
  return { success: true, user: data.user };
}

async function signIn(email, password) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    console.error('登录失败:', error);
    return { success: false, error: error.message };
  }
  return { success: true, user: data.user };
}

async function signOut() {
  const { error } = await supabaseClient.auth.signOut();
  return { success: !error, error: error?.message };
}

async function getCurrentUser() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  return user;
}

function onAuthStateChange(callback) {
  return supabaseClient.auth.onAuthStateChange((event, session) => {
    callback(event, session?.user || null);
  });
}

// 卡组管理函数
async function saveDeck(deckData) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: '未登录' };

  const { data, error } = await supabaseClient
    .from('decks')
    .insert({
      user_id: user.id,
      name: deckData.name || '未命名卡组',
      main_deck: deckData.main || [],
      sideboard: deckData.side || [],
      is_public: deckData.isPublic || false
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, deck: data };
}

async function loadDecks() {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: '未登录' };

  const { data, error } = await supabaseClient
    .from('decks')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  if (error) return { success: false, error: error.message };
  return { success: true, decks: data || [] };
}

async function loadDeck(deckId) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: '未登录' };

  const { data, error } = await supabaseClient
    .from('decks')
    .select('*')
    .eq('id', deckId)
    .eq('user_id', user.id)
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, deck: data };
}

async function deleteDeck(deckId) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: '未登录' };

  const { error } = await supabaseClient
    .from('decks')
    .delete()
    .eq('id', deckId)
    .eq('user_id', user.id);

  return { success: !error, error: error?.message };
}

async function updateDeck(deckId, updates) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: '未登录' };

  const { data, error } = await supabaseClient
    .from('decks')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', deckId)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, deck: data };
}

async function shareDeck(deckId, isPublic) {
  return await updateDeck(deckId, { is_public: isPublic });
}

async function loadPublicDeck(deckId) {
  const { data, error } = await supabaseClient
    .from('decks')
    .select('*')
    .eq('id', deckId)
    .eq('is_public', true)
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, deck: data };
}

function isLoggedIn() {
  return supabaseClient.auth.getUser().then(({ data: { user } }) => !!user);
}

// 导出到全局
window.mtgAuth = {
  signUp, signIn, signOut, getCurrentUser, onAuthStateChange, isLoggedIn,
  saveDeck, updateDeck, loadDecks, loadDeck, deleteDeck, shareDeck, loadPublicDeck,
  supabase: supabaseClient
};

console.log('✅ MTG Deck Builder - Supabase 已初始化');
console.log('✅ window.mtgAuth:', window.mtgAuth);
