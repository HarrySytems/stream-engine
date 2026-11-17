/**
 * FilmTV TikTok Clone - Supabase Database Client
 * Conecta a Supabase con caché en memoria y persistencia local ultra rápida (0ms).
 * 100% Datos reales: Sin comentarios falsos ni datos simulados.
 */

const SUPABASE_URL = 'https://uihplaqldgitgfoxaaph.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_KDlti-xJ5IV97ywwjv3BKQ_ZxM87zmv';

let supabaseClient = null;
const memoryCache = new Map();
let isSupabaseOffline = false;
let lastOfflineCheck = 0;

function initSupabase() {
  if (window.supabase && !supabaseClient) {
    try {
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
      console.log('✅ Supabase inicializado (Publishable Key)');
    } catch (e) {
      console.warn('Error inicializando Supabase:', e);
    }
  }
  return supabaseClient;
}

function getLocalStoredComments(peliculaId) {
  try {
    const key = `filmtv_comments_${peliculaId}`;
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch (e) {
    return [];
  }
}

function saveLocalStoredComments(peliculaId, list) {
  try {
    const key = `filmtv_comments_${peliculaId}`;
    localStorage.setItem(key, JSON.stringify(list));
  } catch (e) {}
}

window.CommentsDB = {
  /**
   * Obtiene comentarios de forma sincrónica e instantánea desde la memoria o localStorage (0ms)
   */
  getCachedComments(peliculaId) {
    const pId = String(peliculaId);
    if (memoryCache.has(pId)) {
      return memoryCache.get(pId);
    }
    const local = getLocalStoredComments(pId);
    memoryCache.set(pId, local);
    return local;
  },

  /**
   * Obtiene comentarios reales con timeout estricto para evitar bloqueos y lag
   */
  async getComments(peliculaId) {
    const pId = String(peliculaId);
    const local = this.getCachedComments(pId);

    const client = initSupabase();
    if (!client) return local;

    // Si Supabase falló recientemente, no saturar la red en cada scroll rápido
    const now = Date.now();
    if (isSupabaseOffline && (now - lastOfflineCheck < 45000)) {
      return local;
    }

    try {
      // Timeout estricto de 1.2 segundos para que jamás congele la interfaz
      const queryPromise = client
        .from('comentarios')
        .select('*')
        .eq('pelicula_id', pId)
        .order('created_at', { ascending: false })
        .limit(100);

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Supabase network timeout')), 1200)
      );

      const { data, error } = await Promise.race([queryPromise, timeoutPromise]);

      if (error) {
        isSupabaseOffline = true;
        lastOfflineCheck = now;
        return local;
      }

      isSupabaseOffline = false;
      const combined = [...(data || [])];
      // Fusionar cualquier comentario local
      local.forEach(l => {
        if (!combined.some(c => c.id === l.id)) {
          combined.unshift(l);
        }
      });

      memoryCache.set(pId, combined);
      saveLocalStoredComments(pId, combined);
      return combined;
    } catch (err) {
      isSupabaseOffline = true;
      lastOfflineCheck = now;
      return local;
    }
  },

  /**
   * Inserta un nuevo comentario real de inmediato (0ms UI) y sincroniza en segundo plano
   */
  async addComment(peliculaId, usuario, comentario) {
    const pId = String(peliculaId);
    const cleanUser = (usuario || 'Usuario_FilmTV').trim();
    const cleanComment = (comentario || '').trim();

    if (!cleanComment) return null;

    const newObj = {
      id: 'cmt-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
      pelicula_id: pId,
      usuario: cleanUser,
      comentario: cleanComment,
      avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(cleanUser)}`,
      likes: 0,
      created_at: new Date().toISOString()
    };

    // Guardar inmediatamente en memoria y almacenamiento local
    const currentList = this.getCachedComments(pId);
    currentList.unshift(newObj);
    memoryCache.set(pId, currentList);
    saveLocalStoredComments(pId, currentList);

    // Intentar sincronización con Supabase en segundo plano sin bloquear la UI
    const client = initSupabase();
    if (client && !isSupabaseOffline) {
      client
        .from('comentarios')
        .insert([{
          pelicula_id: pId,
          usuario: cleanUser,
          comentario: cleanComment,
          avatar: newObj.avatar,
          likes: 0
        }])
        .select()
        .then(({ data }) => {
          if (data && data[0]) {
            newObj.id = data[0].id;
            saveLocalStoredComments(pId, currentList);
          }
        })
        .catch(() => {});
    }

    return newObj;
  },

  /**
   * Da like a un comentario
   */
  async likeComment(commentId, currentLikes) {
    const newCount = (currentLikes || 0) + 1;
    const client = initSupabase();
    if (client && !isSupabaseOffline && !String(commentId).startsWith('cmt-') && !String(commentId).startsWith('local-')) {
      client
        .from('comentarios')
        .update({ likes: newCount })
        .eq('id', commentId)
        .catch(() => {});
    }
    return newCount;
  }
};
