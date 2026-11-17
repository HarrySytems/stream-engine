/**
 * FilmTV TikTok Clone - Main Application Logic
 * Optimizaciones para scroll ultrarrápido y navegación fluida con flechas flotantes en PC.
 * 100% Datos reales con categorías integradas y soporte HLS/YouTube.
 */

(function () {
  'use strict';

  // Estado global de la aplicación
  let currentSection = 'para_ti';
  let currentFeed = [];
  let currentActiveIndex = 0;
  let isGlobalMuted = false; // Sonido siempre activo por defecto
  let currentHlsInstance = null;
  let scrollDebounceTimer = null;
  let isWheelScrolling = false;
  let wheelTimeout = null;
  let targetWheelIndex = 0;
  let feedObserver = null;
  let isAppending = false;

  // Ajuste de altura real de pantalla en móviles (--vh para cubrir cualquier navegador)
  function updateViewportHeight() {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
  }
  updateViewportHeight();
  window.addEventListener('resize', updateViewportHeight);
  window.addEventListener('orientationchange', updateViewportHeight);

  const userLikes = new Set(JSON.parse(localStorage.getItem('filmtv_likes') || '[]'));

  // Memoria de sesión para evitar repeticiones de clips vistos (Estilo TikTok)
  const watchedSessionKey = 'filmtv_watched_session';
  let watchedIds = new Set(JSON.parse(sessionStorage.getItem(watchedSessionKey) || '[]'));

  function markAsWatched(id) {
    if (!id) return;
    watchedIds.add(id);
    if (watchedIds.size > 100) {
      const firstVal = watchedIds.values().next().value;
      watchedIds.delete(firstVal);
    }
    try {
      sessionStorage.setItem(watchedSessionKey, JSON.stringify([...watchedIds]));
    } catch (e) {}
  }

  // Algoritmo Fisher-Yates: Barajado uniforme y matemáticamente perfecto sin repetición
  function fisherYatesShuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // Generador inteligente de contenido dinámico para cada sección
  function buildSmartFeed(sectionKey) {
    let items = [];
    if (window.CATALOG && window.CATALOG[sectionKey]) {
      items = window.CATALOG[sectionKey];
    }
    if (!items || items.length === 0) return [];

    function separateUnseenAndSeen(list) {
      const unseen = [];
      const seen = [];
      list.forEach((item) => {
        if (watchedIds.has(item.id)) {
          seen.push(item);
        } else {
          unseen.push(item);
        }
      });
      // Barajar ambos bloques de manera completamente aleatoria
      const shuffledUnseen = fisherYatesShuffle(unseen);
      const shuffledSeen = fisherYatesShuffle(seen);
      // Los clips NO vistos en esta sesión van PRIMERO para garantizar variedad continua
      return [...shuffledUnseen, ...shuffledSeen];
    }

    // 1. En Para ti: SOLO contenido grabado (Películas, Series, Anime). CERO canales en vivo.
    if (sectionKey === 'para_ti') {
      const recordedOnly = items.filter((item) => item.tipo !== 'canal' && !item.streamUrl && item.seccion !== 'tdt' && item.seccion !== 'free' && item.seccion !== 'tvcable');
      return separateUnseenAndSeen(recordedOnly);
    }

    // 2. En Películas: Los estrenos siempre van arriba, pero barajados para que el primer estreno cambie siempre
    if (sectionKey === 'peliculas') {
      const estrenos = items.filter((item) => item.año === '2026' || item.año === '2025' || (item.descripcion && item.descripcion.includes('2026')));
      const resto = items.filter((item) => !estrenos.includes(item));

      return [...separateUnseenAndSeen(estrenos), ...separateUnseenAndSeen(resto)];
    }

    // 3. En Series, Anime, TDT, FREE y TV Cable:
    // Barajado completo priorizando siempre contenido fresco no visto
    return separateUnseenAndSeen(items);
  }

  // Elementos del DOM
  const feedContainer = document.getElementById('feedContainer');
  const sidebarNav = document.getElementById('sidebarNav');
  const mobileTabs = document.getElementById('mobileTabs');
  const brandLogoHome = document.getElementById('brandLogoHome');

  // Flechas flotantes en PC
  const btnFloatUp = document.getElementById('btnFloatUp');
  const btnFloatDown = document.getElementById('btnFloatDown');

  const commentsPanel = document.getElementById('commentsPanel');
  const commentsList = document.getElementById('commentsList');
  const commentsHeaderCount = document.getElementById('commentsHeaderCount');
  const btnCloseComments = document.getElementById('btnCloseComments');
  const commentForm = document.getElementById('commentForm');
  const commentTextInput = document.getElementById('commentTextInput');
  const commentUserHandle = document.getElementById('commentUserHandle');
  const btnSendComment = document.getElementById('btnSendComment');
  const commentsBackdrop = document.getElementById('commentsBackdrop');

  const searchInput = document.getElementById('searchInput');
  const btnClearSearch = document.getElementById('btnClearSearch');
  const btnMobileSearch = document.getElementById('btnMobileSearch');
  const toastNotice = document.getElementById('toastNotice');
  const toastMsg = document.getElementById('toastMsg');
  const fileProtocolWarning = document.getElementById('fileProtocolWarning');
  const btnDismissWarning = document.getElementById('btnDismissWarning');

  // Elementos del Reproductor de Cine Integrado (In-App Cinema Full Player)
  const fullPlayerOverlay = document.getElementById('fullPlayerOverlay');
  const btnBackToFeed = document.getElementById('btnBackToFeed');
  const btnBackToFeedText = document.getElementById('btnBackToFeedText');
  const fullPlayerCategoryPill = document.getElementById('fullPlayerCategoryPill');
  const fullPlayerHeaderTitle = document.getElementById('fullPlayerHeaderTitle');
  const btnShareFullMovie = document.getElementById('btnShareFullMovie');
  const fullPlayerServersContainer = document.getElementById('fullPlayerServersContainer');
  const fullPlayerServersList = document.getElementById('fullPlayerServersList');
  const fullPlayerMediaHost = document.getElementById('fullPlayerMediaHost');
  const fullPlayerLoader = document.getElementById('fullPlayerLoader');
  const fullPlayerYear = document.getElementById('fullPlayerYear');
  const fullPlayerGenre = document.getElementById('fullPlayerGenre');
  const fullPlayerRating = document.getElementById('fullPlayerRating');
  const fullPlayerQuality = document.getElementById('fullPlayerQuality');
  const fullPlayerTitle = document.getElementById('fullPlayerTitle');
  const fullPlayerSynopsis = document.getElementById('fullPlayerSynopsis');

  // Comprobar protocolo file:///
  if (window.location.protocol === 'file:') {
    fetch('http://localhost:3000/index.html', { mode: 'no-cors' })
      .then(() => {
        window.location.href = 'http://localhost:3000/';
      })
      .catch(() => {
        if (fileProtocolWarning) fileProtocolWarning.classList.add('show');
      });
  }

  if (btnDismissWarning) {
    btnDismissWarning.addEventListener('click', () => {
      fileProtocolWarning.classList.remove('show');
    });
  }

  // Nombre de usuario en Supabase
  if (localStorage.getItem('filmtv_username')) {
    commentUserHandle.value = localStorage.getItem('filmtv_username');
  }
  commentUserHandle.addEventListener('change', () => {
    localStorage.setItem('filmtv_username', commentUserHandle.value.trim() || 'Usuario_FilmTV');
  });

  commentTextInput.addEventListener('input', () => {
    btnSendComment.disabled = !commentTextInput.value.trim();
  });

  // ==========================================================================
  // INICIALIZACIÓN
  // ==========================================================================
  function initApp() {
    setupNavigationEvents();
    setupFloatingArrows();
    setupWheelNavigation();
    setupKeyNavigation();
    setupCinemaPlayerEvents();
    setupSearch();
    switchSection('para_ti');
  }

  // ==========================================================================
  // FLECHAS FLOTANTES (PC) Y NAVEGACIÓN RÁPIDA
  // ==========================================================================
  function setupFloatingArrows() {
    if (btnFloatUp) {
      btnFloatUp.addEventListener('click', (e) => {
        e.preventDefault();
        scrollToIndex(currentActiveIndex - 1);
      });
    }

    if (btnFloatDown) {
      btnFloatDown.addEventListener('click', (e) => {
        e.preventDefault();
        if (currentActiveIndex >= currentFeed.length - 4) {
          appendMoreReels();
        }
        scrollToIndex(currentActiveIndex + 1);
      });
    }
  }

  function updateFloatingArrowsState() {
    if (btnFloatUp) {
      btnFloatUp.disabled = (currentActiveIndex <= 0);
    }
    if (btnFloatDown) {
      // Con scroll infinito siempre hay contenido disponible hacia abajo
      btnFloatDown.disabled = false;
    }
  }

  function scrollToIndex(index) {
    if (index < 0) return;
    if (index >= currentFeed.length - 4) {
      appendMoreReels();
    }
    const safeIndex = Math.min(currentFeed.length - 1, index);
    const targetReel = document.getElementById(`reel-${safeIndex}`);
    if (targetReel) {
      targetReel.scrollIntoView({ behavior: 'smooth' });
    }
  }

  // Optimización de giro de rueda del ratón en PC (TikTok Feel, sin congelamiento ni saltos trabados)
  function setupWheelNavigation() {
    feedContainer.addEventListener('wheel', (e) => {
      // Si el usuario está interactuando con la lista de comentarios, permitir scroll nativo de ese panel
      if (e.target.closest('#commentsPanel')) return;

      if (Math.abs(e.deltaY) > 25) {
        if (wheelTimeout) clearTimeout(wheelTimeout);

        const direction = e.deltaY > 0 ? 1 : -1;
        targetWheelIndex = Math.max(0, (isWheelScrolling ? targetWheelIndex : currentActiveIndex) + direction);

        if (targetWheelIndex >= currentFeed.length - 4) {
          appendMoreReels();
        }

        targetWheelIndex = Math.min(currentFeed.length - 1, targetWheelIndex);

        isWheelScrolling = true;
        scrollToIndex(targetWheelIndex);

        wheelTimeout = setTimeout(() => {
          isWheelScrolling = false;
        }, 150);
      }
    }, { passive: true });
  }

  function setupKeyNavigation() {
    window.addEventListener('keydown', (e) => {
      if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
        return;
      }

      if (e.key === 'ArrowDown' || e.key === 'j' || e.key === 'PageDown') {
        e.preventDefault();
        if (currentActiveIndex >= currentFeed.length - 4) {
          appendMoreReels();
        }
        scrollToIndex(currentActiveIndex + 1);
      } else if (e.key === 'ArrowUp' || e.key === 'k' || e.key === 'PageUp') {
        e.preventDefault();
        scrollToIndex(currentActiveIndex - 1);
      }
    });
  }

  // ==========================================================================
  // CAMBIO DE CATEGORÍAS (SIN SALIR DE LA PÁGINA)
  // ==========================================================================
  function setupNavigationEvents() {
    if (brandLogoHome) {
      brandLogoHome.addEventListener('click', (e) => {
        e.preventDefault();
        switchSection('para_ti');
      });
    }

    if (sidebarNav) {
      sidebarNav.querySelectorAll('.nav-item').forEach((btn) => {
        btn.addEventListener('click', () => {
          const seccion = btn.dataset.seccion;
          if (seccion) switchSection(seccion);
        });
      });
    }

    if (mobileTabs) {
      mobileTabs.querySelectorAll('.mobile-tab-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const seccion = btn.dataset.seccion;
          if (seccion) switchSection(seccion);
        });
      });
    }
  }

  function switchSection(sectionKey) {
    currentSection = sectionKey;

    if (sidebarNav) {
      sidebarNav.querySelectorAll('.nav-item').forEach((btn) => {
        if (btn.dataset.seccion === sectionKey) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    }

    if (mobileTabs) {
      mobileTabs.querySelectorAll('.mobile-tab-btn').forEach((btn) => {
        if (btn.dataset.seccion === sectionKey) {
          btn.classList.add('active');
          btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        } else {
          btn.classList.remove('active');
        }
      });
    }

    // Generar feed dinámico y rotativo sin repeticiones consecutivas
    currentFeed = buildSmartFeed(sectionKey);

    feedContainer.scrollTop = 0;
    currentActiveIndex = 0;

    renderFeed(currentFeed);
    setupScrollObserver();
    updateFloatingArrowsState();

    if (currentFeed.length > 0) {
      mountActiveMedia(0);
      loadCommentsForMovie(currentFeed[0].id);
    }
  }

  // ==========================================================================
  // RENDERIZADO DEL FEED DE REELS (CON CARGA INFINITA Y CERO RETARDO)
  // ==========================================================================
  function createReelElement(item, index) {
    const isLiked = userLikes.has(item.id);
    const likesDisplay = isLiked ? 1 : 0;

    const isLive = item.tipo === 'canal';
    const hasTrailer = Boolean(item.trailerKey);
    const badgeText = isLive ? 'EN VIVO' : (hasTrailer ? 'TRAILER HD' : 'TRÁILER NO DISPONIBLE');
    const badgeClass = isLive ? 'live-indicator live' : (hasTrailer ? 'live-indicator' : 'live-indicator no-trailer');
    const ctaText = item.btnTexto || (isLive ? 'Ver Canal en Vivo' : (item.tipo === 'serie' ? 'Ver Serie Completa' : (item.tipo === 'anime' ? 'Ver Anime Completo' : 'Ver Película Completa')));

    const reel = document.createElement('section');
    reel.className = 'reel-item';
    reel.id = `reel-${index}`;
    reel.dataset.index = index;
    reel.dataset.id = item.id;
    reel.dataset.tipo = item.tipo;
    reel.dataset.trailerKey = item.trailerKey || '';
    reel.dataset.streamUrl = item.streamUrl || '';
    reel.dataset.title = item.titulo;

    reel.innerHTML = `
      <div class="video-card-wrapper">
        <!-- Card 9:16 Video Player -->
        <div class="video-card">
          <!-- Escudo transparente: bloquea clics directos a YouTube, sin cursor de mano, conmute play/pause -->
          <div class="video-shield-overlay" data-index="${index}"></div>

          <!-- Indicador central de reproducción/pausa (Estilo TikTok al tocar la pantalla) -->
          <div class="video-play-indicator" id="play-indicator-${index}">
            <svg viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </div>

          ${(!hasTrailer && !isLive) ? `
          <!-- Badge elegante cuando no hay trailer disponible -->
          <div class="no-trailer-badge">
            <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="#ffcc00" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
            </svg>
            <span>Tráiler no disponible</span>
            <small>Presiona el botón de abajo para ver la película completa</small>
          </div>
          ` : ''}

          <div class="video-player-container" id="player-container-${index}">
            <img src="${item.poster}" alt="${item.titulo}" class="video-poster-fallback" loading="${index < 3 ? 'eager' : 'lazy'}">
          </div>

          <!-- Top Controls (Badge oficial, sonido siempre activo) -->
          <div class="video-top-overlay">
            <span class="${badgeClass}">${badgeText}</span>
          </div>

          <!-- Bottom Video Metadata -->
          <div class="video-info-overlay">
            <div class="video-tags-row">
              <span class="badge-tag">${item.categoria}</span>
              <span class="badge-tag">${item.año}</span>
              <span class="badge-tag rating">★ ${item.valoracion}</span>
            </div>
            
            <h2 class="video-title">${item.titulo}</h2>
            
            <p class="video-desc" id="desc-${index}">${item.descripcion}</p>
            ${item.descripcion.length > 80 ? `<button class="btn-more-desc" data-target="desc-${index}">más</button>` : ''}

            <!-- BOTÓN DESTACADO: ABRE REPRODUCTOR DE CINE INTEGRADO -->
            <button class="btn-watch-movie" title="Ver ${item.titulo}">
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path d="M8 5v14l11-7z"/>
              </svg>
              <span>${ctaText}</span>
            </button>
          </div>
        </div>

        <!-- Right Action Bar -->
        <div class="action-bar">
          <!-- Like -->
          <div class="action-btn-item">
            <button class="action-circle-btn btn-like ${isLiked ? 'liked' : ''}" data-id="${item.id}" aria-label="Me gusta">
              <svg viewBox="0 0 24 24">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
              </svg>
            </button>
            <span class="action-count count-likes">${likesDisplay}</span>
          </div>

          <!-- Comments -->
          <div class="action-btn-item">
            <button class="action-circle-btn btn-comments ${isLive ? 'comments-disabled-btn' : ''}" data-id="${item.id}" data-islive="${isLive ? 'true' : 'false'}" aria-label="Comentarios" title="${isLive ? 'Comentarios desactivados para En Vivo' : 'Comentarios'}">
              <svg viewBox="0 0 24 24">
                <path d="M21.99 4c0-1.1-.89-2-1.99-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18zM18 14H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
              </svg>
            </button>
            <span class="action-count count-comments" id="comment-count-badge-${item.id}">${isLive ? 'Off' : '0'}</span>
          </div>

          <!-- Share -->
          <div class="action-btn-item">
            <button class="action-circle-btn btn-share" data-url="${item.urlDestino}" data-title="${item.titulo}" aria-label="Compartir">
              <svg viewBox="0 0 24 24">
                <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"/>
              </svg>
            </button>
            <span class="action-count">0</span>
          </div>
        </div>
      </div>
    `;

    bindReelEvents(reel, index);
    return reel;
  }

  function bindReelEvents(reel, index) {
    const watchBtn = reel.querySelector('.btn-watch-movie');
    if (watchBtn) {
      let isTriggered = false;
      const handleOpenFullPlayer = (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        if (isTriggered) return;
        isTriggered = true;
        setTimeout(() => { isTriggered = false; }, 500);

        const item = currentFeed[index];
        if (item) {
          openFullPlayer(item);
        }
      };

      watchBtn.addEventListener('click', handleOpenFullPlayer);
      watchBtn.addEventListener('touchend', handleOpenFullPlayer, { passive: false });
    }

    const likeBtn = reel.querySelector('.btn-like');
    if (likeBtn) {
      likeBtn.addEventListener('click', () => {
        const movieId = likeBtn.dataset.id;
        const countSpan = likeBtn.closest('.action-btn-item').querySelector('.count-likes');
        if (userLikes.has(movieId)) {
          userLikes.delete(movieId);
          likeBtn.classList.remove('liked');
          countSpan.textContent = '0';
        } else {
          userLikes.add(movieId);
          likeBtn.classList.add('liked');
          countSpan.textContent = '1';
        }
        localStorage.setItem('filmtv_likes', JSON.stringify([...userLikes]));
      });
    }

    const shareBtn = reel.querySelector('.btn-share');
    if (shareBtn) {
      shareBtn.addEventListener('click', () => {
        const url = shareBtn.dataset.url || window.location.href;
        navigator.clipboard.writeText(url).then(() => {
          showToast('¡Enlace copiado al portapapeles!');
        }).catch(() => {
          showToast('Copia este enlace: ' + url);
        });
      });
    }

    const commentsBtn = reel.querySelector('.btn-comments');
    if (commentsBtn) {
      commentsBtn.addEventListener('click', () => {
        const movieId = commentsBtn.dataset.id;
        toggleCommentsPanel(true);
        loadCommentsForMovie(movieId);
      });
    }

    const moreBtn = reel.querySelector('.btn-more-desc');
    if (moreBtn) {
      moreBtn.addEventListener('click', () => {
        const targetId = moreBtn.dataset.target;
        const descEl = document.getElementById(targetId);
        if (descEl) {
          descEl.classList.toggle('expanded');
          moreBtn.textContent = descEl.classList.contains('expanded') ? 'menos' : 'más';
        }
      });
    }

    const shield = reel.querySelector('.video-shield-overlay');
    if (shield) {
      shield.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        togglePlayPause(index);
      });
    }
  }

  function renderFeed(items) {
    if (currentHlsInstance) {
      try {
        currentHlsInstance.destroy();
      } catch (e) {}
      currentHlsInstance = null;
    }

    feedContainer.innerHTML = '';

    if (!items || items.length === 0) {
      feedContainer.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; color:#888;">
          <p style="font-size:18px; margin-bottom:12px;">No hay contenido disponible en esta sección.</p>
          <button onclick="location.reload()" style="background:#ffcc00; color:#000; border:none; padding:10px 20px; border-radius:6px; font-weight:700; cursor:pointer;">Volver a Para ti</button>
        </div>
      `;
      return;
    }

    items.forEach((item, index) => {
      const reel = createReelElement(item, index);
      feedContainer.appendChild(reel);
    });
  }

  // Carga infinita automática: añade nuevos lotes barajados para que el usuario pueda bajar miles de videos
  function appendMoreReels() {
    if (isAppending) return;
    if (searchInput && searchInput.value.trim()) return; // No mezclar con búsqueda activa
    isAppending = true;

    let baseItems = [];
    if (currentSection === 'para_ti') {
      baseItems = (window.CATALOG['para_ti'] || []).filter((item) => item.tipo !== 'canal' && !item.streamUrl && item.seccion !== 'tdt' && item.seccion !== 'free' && item.seccion !== 'tvcable');
    } else if (window.CATALOG && window.CATALOG[currentSection]) {
      baseItems = window.CATALOG[currentSection];
    }

    if (!baseItems || baseItems.length === 0) {
      isAppending = false;
      return;
    }

    const freshBatch = fisherYatesShuffle(baseItems);
    const startIndex = currentFeed.length;

    freshBatch.forEach((item, offset) => {
      const newIndex = startIndex + offset;
      currentFeed.push(item);
      const reelEl = createReelElement(item, newIndex);
      feedContainer.appendChild(reelEl);
      if (feedObserver) {
        feedObserver.observe(reelEl);
      }
    });

    updateFloatingArrowsState();

    setTimeout(() => {
      isAppending = false;
    }, 120);
  }

  // ==========================================================================
  // AUTOPLAY CON DEBOUNCE PARA SCROLL RÁPIDO (CERO LAG A 60 FPS)
  // ==========================================================================
  function setupScrollObserver() {
    if (feedObserver) {
      feedObserver.disconnect();
    }

    const observerOptions = {
      root: feedContainer,
      threshold: 0.60
    };

    feedObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const reel = entry.target;
        const index = parseInt(reel.dataset.index, 10);
        const movieId = reel.dataset.id;

        if (entry.isIntersecting) {
          currentActiveIndex = index;
          updateFloatingArrowsState();

          // Auto-inyección continua cuando el usuario está a 4 videos o menos del final
          if (currentActiveIndex >= currentFeed.length - 4) {
            appendMoreReels();
          }

          if (scrollDebounceTimer) clearTimeout(scrollDebounceTimer);

          // 140ms tras detenerse el scroll para montar el video sin congelar la pantalla
          scrollDebounceTimer = setTimeout(() => {
            mountActiveMedia(index);
            loadCommentsForMovie(movieId);
          }, 140);
        } else {
          unmountMedia(index);
        }
      });
    }, observerOptions);

    document.querySelectorAll('.reel-item').forEach((reel) => {
      feedObserver.observe(reel);
    });
  }

  function mountActiveMedia(index) {
    const container = document.getElementById(`player-container-${index}`);
    if (!container) return;

    const item = currentFeed[index];
    if (!item) return;

    markAsWatched(item.id);

    const reel = document.getElementById(`reel-${index}`);
    if (reel) reel.dataset.paused = 'false';
    const playIndicator = document.getElementById(`play-indicator-${index}`);
    if (playIndicator) playIndicator.classList.remove('show');

    // Destruir HLS anterior para evitar fugas de memoria y sobrecarga en canales en vivo
    if (currentHlsInstance) {
      try {
        currentHlsInstance.destroy();
      } catch (e) {}
      currentHlsInstance = null;
    }

    // 1. Canal en Vivo (HLS)
    if (item.streamUrl) {
      if (container.querySelector('video')) return;

      const video = document.createElement('video');
      video.playsInline = true;
      video.autoplay = true;
      video.muted = false; // Sonido activo por defecto desde el inicio
      video.volume = 1.0;
      video.loop = true;
      video.className = 'video-stream-el';

      container.innerHTML = '';
      container.appendChild(video);

      video.addEventListener('play', () => {
        if (playIndicator) playIndicator.classList.remove('show');
        if (reel) reel.dataset.paused = 'false';
      });
      video.addEventListener('playing', () => {
        if (playIndicator) playIndicator.classList.remove('show');
        if (reel) reel.dataset.paused = 'false';
      });
      video.addEventListener('pause', () => {
        if (playIndicator) playIndicator.classList.add('show');
        if (reel) reel.dataset.paused = 'true';
      });

      if (window.Hls && Hls.isSupported() && item.streamUrl.includes('.m3u8')) {
        currentHlsInstance = new Hls({ enableWorker: true, lowLatencyMode: true });
        currentHlsInstance.loadSource(item.streamUrl);
        currentHlsInstance.attachMedia(video);
        currentHlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
          const p = video.play();
          if (p !== undefined) {
            p.catch(() => {
              video.muted = true;
              video.play().catch(() => {});
            });
          }
        });
        currentHlsInstance.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                currentHlsInstance.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                currentHlsInstance.recoverMediaError();
                break;
              default:
                currentHlsInstance.destroy();
                break;
            }
          }
        });
      } else {
        video.src = item.streamUrl;
        const p = video.play();
        if (p !== undefined) {
          p.catch(() => {
            video.muted = true;
            video.play().catch(() => {});
          });
        }
      }
      return;
    }

    // 2. Trailer de YouTube (Autoplay garantizado sin botón rojo de YouTube y audio continuo)
    if (item.trailerKey) {
      if (container.querySelector('iframe')) return;

      const originParam = (window.location.origin && window.location.origin !== 'null') 
        ? window.location.origin 
        : 'http://localhost:3000';

      const iframe = document.createElement('iframe');
      // Siempre inicializar con mute=1 para que Chrome móvil y Safari permitan autoplay inmediato al 100% sin mostrar el botón rojo gigante
      iframe.src = `https://www.youtube.com/embed/${item.trailerKey}?autoplay=1&mute=1&controls=0&playsinline=1&rel=0&modestbranding=1&disablekb=1&iv_load_policy=3&enablejsapi=1&fs=0&loop=1&playlist=${item.trailerKey}&origin=${encodeURIComponent(originParam)}`;
      iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
      iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
      iframe.setAttribute('allowfullscreen', 'true');
      iframe.id = `iframe-player-${index}`;

      container.innerHTML = '';
      container.appendChild(iframe);

      const sendUnmute = () => {
        if (!isGlobalMuted && iframe.contentWindow) {
          try {
            iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'unMute', args: [] }), '*');
            iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'setVolume', args: [100] }), '*');
            iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'playVideo', args: [] }), '*');
          } catch (e) {}
        }
      };

      [200, 500, 1000, 1800].forEach((delay) => {
        setTimeout(sendUnmute, delay);
      });
      iframe.addEventListener('load', () => {
        [150, 450, 900].forEach((delay) => setTimeout(sendUnmute, delay));
      });
    }
  }

  function unmountMedia(index) {
    const container = document.getElementById(`player-container-${index}`);
    if (!container) return;

    const reel = document.getElementById(`reel-${index}`);
    if (reel) reel.dataset.paused = 'false';
    const playIndicator = document.getElementById(`play-indicator-${index}`);
    if (playIndicator) playIndicator.classList.remove('show');

    // Detener de raíz instancia HLS y trabajadores de stream
    if (currentHlsInstance) {
      try {
        currentHlsInstance.destroy();
      } catch (e) {}
      currentHlsInstance = null;
    }

    // Detener y liberar video HTML5 si existía
    const video = container.querySelector('video');
    if (video) {
      video.pause();
      video.removeAttribute('src');
      video.load();
    }

    const item = currentFeed[index];
    if (item) {
      container.innerHTML = `<img src="${item.poster}" alt="${item.titulo}" class="video-poster-fallback" loading="lazy">`;
    }
  }

  // Escudo global de auto-recuperación ante errores de reproducción en YouTube
  window.addEventListener('message', (e) => {
    try {
      const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
      if (data && data.event === 'onError') {
        const targetContainer = document.getElementById(`player-container-${currentActiveIndex}`);
        const currentItem = currentFeed[currentActiveIndex];
        if (targetContainer && currentItem) {
          targetContainer.innerHTML = `
            <div class="video-error-fallback">
              <img src="${currentItem.poster}" alt="${currentItem.titulo}" class="video-poster-fallback">
              <div class="video-error-badge">
                <span>Tráiler en proceso de actualización</span>
              </div>
            </div>
          `;
        }
      }
    } catch (err) {}
  });



  // ==========================================================================
  // CONTROL DE REPRODUCCIÓN / PAUSA (ESTILO TIKTOK AL TOCAR EL VIDEO)
  // ==========================================================================
  function togglePlayPause(index) {
    const container = document.getElementById(`player-container-${index}`);
    if (!container) return;
    const playIndicator = document.getElementById(`play-indicator-${index}`);
    const reel = document.getElementById(`reel-${index}`);
    const item = currentFeed[index];
    if (!item) return;

    markAsWatched(item.id);

    // 1. Canal en vivo (Video HTML5)
    if (item.streamUrl) {
      const video = container.querySelector('video');
      if (video) {
        if (video.paused) {
          video.play().then(() => {
            if (playIndicator) playIndicator.classList.remove('show');
            if (reel) reel.dataset.paused = 'false';
          }).catch(() => {
            video.muted = true;
            video.play().catch(() => {});
            if (playIndicator) playIndicator.classList.remove('show');
            if (reel) reel.dataset.paused = 'false';
          });
        } else {
          video.pause();
          if (playIndicator) playIndicator.classList.add('show');
          if (reel) reel.dataset.paused = 'true';
        }
      }
      return;
    }

    // 2. Trailer YouTube (vía postMessage seguro de la API iframe)
    if (item.trailerKey) {
      const iframe = container.querySelector('iframe');
      if (iframe && iframe.contentWindow && reel) {
        const isCurrentlyPaused = (reel.dataset.paused === 'true');
        if (isCurrentlyPaused) {
          // Quitar pausa: reanudar reproducción y ocultar botón de play
          iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'playVideo', args: [] }), '*');
          reel.dataset.paused = 'false';
          if (playIndicator) playIndicator.classList.remove('show');
        } else {
          // Poner pausa: pausar video y mostrar botón de play
          iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }), '*');
          reel.dataset.paused = 'true';
          if (playIndicator) playIndicator.classList.add('show');
        }
      }
    }
  }

  // Desbloqueo universal de audio mediante gestos de usuario (touchstart, touchend, pointerup, click, keydown)
  let audioUnlocked = false;

  function ensureAudioUnlocked() {
    isGlobalMuted = false;
    audioUnlocked = true;

    // Activar contexto de audio del navegador si está suspendido
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        const audioCtx = new AudioCtx();
        audioCtx.resume().catch(() => {});
      }
    } catch (e) {}

    const currentContainer = document.getElementById(`player-container-${currentActiveIndex}`);
    if (currentContainer) {
      const video = currentContainer.querySelector('video');
      if (video) {
        video.muted = false;
        video.volume = 1.0;
        video.play().catch(() => {});
      }
      const iframe = currentContainer.querySelector('iframe');
      if (iframe && iframe.contentWindow) {
        try {
          iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'unMute', args: [] }), '*');
          iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'setVolume', args: [100] }), '*');
          iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'playVideo', args: [] }), '*');
        } catch (e) {}
      }
    }
  }

  ['touchstart', 'touchend', 'pointerdown', 'pointerup', 'click', 'keydown'].forEach((evt) => {
    window.addEventListener(evt, ensureAudioUnlocked, { passive: true });
  });

  // ==========================================================================
  // PANEL DE COMENTARIOS (SUPABASE REAL + CACHÉ ULTRA RÁPIDO 0ms)
  // ==========================================================================
  let activeMovieIdForComments = null;
  let commentFetchCounter = 0;

  function loadCommentsForMovie(movieId) {
    activeMovieIdForComments = movieId;

    const currentItem = currentFeed.find((item) => item.id === movieId);
    const isLiveChannel = currentItem && (currentItem.tipo === 'canal' || currentItem.streamUrl || currentItem.seccion === 'tdt' || currentItem.seccion === 'free' || currentItem.seccion === 'tvcable');

    const commentUserBadge = document.getElementById('commentUserBadge');
    const commentLiveDisabledNotice = document.getElementById('commentLiveDisabledNotice');

    // 1. Canales en vivo (TDT, FREE, TV Cable): Desactivados al instante (0ms)
    if (isLiveChannel) {
      const sectionName = currentItem.seccion ? currentItem.seccion.toUpperCase() : 'EN VIVO';
      commentsHeaderCount.textContent = 'Comentarios (Desactivados)';

      commentsList.innerHTML = `
        <div class="comments-empty-state comments-live-disabled">
          <div style="width: 58px; height: 58px; border-radius: 50%; background: rgba(254, 44, 85, 0.12); display: flex; align-items: center; justify-content: center; margin-bottom: 14px;">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#fe2c55" stroke-width="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              <line x1="2" y1="2" x2="22" y2="22" stroke="#fe2c55" stroke-width="2.5"></line>
            </svg>
          </div>
          <p style="font-weight: 800; color: #fff; font-size: 14px; letter-spacing: 0.5px; text-transform: uppercase;">
            COMENTARIOS DESACTIVADOS PARA ${escapeHTML(sectionName)}
          </p>
          <p style="font-size: 12px; color: #888; margin-top: 8px; line-height: 1.5; max-width: 270px; text-align: center;">
            Las transmisiones en vivo no admiten comentarios. Puedes comentar en películas, series y anime.
          </p>
        </div>
      `;

      if (commentUserBadge) commentUserBadge.style.display = 'none';
      if (commentForm) commentForm.style.display = 'none';
      if (commentLiveDisabledNotice) {
        commentLiveDisabledNotice.style.display = 'block';
        commentLiveDisabledNotice.innerHTML = `<span>COMENTARIOS DESACTIVADOS PARA ${escapeHTML(sectionName)}</span>`;
      }
      return;
    }

    // 2. Contenido grabado (Películas, Series, Anime):
    if (commentUserBadge) commentUserBadge.style.display = 'flex';
    if (commentForm) commentForm.style.display = 'flex';
    if (commentLiveDisabledNotice) commentLiveDisabledNotice.style.display = 'none';

    // RENDERIZADO INMEDIATO EN 0 MILISEGUNDOS (Sin bloqueos ni textos de "Cargando...")
    const cached = window.CommentsDB.getCachedComments(movieId);
    renderCommentsList(cached);
    const count = cached ? cached.length : 0;
    commentsHeaderCount.textContent = `Comentarios (${count})`;
    const badge = document.getElementById(`comment-count-badge-${movieId}`);
    if (badge) badge.textContent = String(count);

    // Consulta en segundo plano ultra rápida sin bloquear el scroll de la interfaz
    const currentReq = ++commentFetchCounter;
    window.CommentsDB.getComments(movieId).then((freshComments) => {
      // Si el usuario ya subió, bajó o cambió de video, descartar
      if (currentReq !== commentFetchCounter || activeMovieIdForComments !== movieId) {
        return;
      }
      if (freshComments) {
        renderCommentsList(freshComments);
        const freshCount = freshComments.length;
        commentsHeaderCount.textContent = `Comentarios (${freshCount})`;
        if (badge) badge.textContent = String(freshCount);
      }
    }).catch(() => {});
  }

  function renderCommentsList(comments) {
    commentsList.innerHTML = '';

    if (!comments || comments.length === 0) {
      commentsList.innerHTML = `
        <div class="comments-empty-state">
          <p style="font-weight:600; color:#fff;">Aún no hay comentarios</p>
          <p style="font-size:12px; color:#888;">¡Sé el primero en comentar!</p>
        </div>
      `;
      return;
    }

    comments.forEach((c) => {
      const itemEl = document.createElement('div');
      itemEl.className = 'comment-item';
      itemEl.id = `comment-${c.id}`;

      const timeAgo = formatTimeAgo(c.created_at);
      const avatarUrl = c.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(c.usuario)}`;

      itemEl.innerHTML = `
        <img src="${avatarUrl}" alt="${c.usuario}" class="comment-avatar">
        <div class="comment-content">
          <span class="comment-author">${escapeHTML(c.usuario)}</span>
          <p class="comment-text">${escapeHTML(c.comentario)}</p>
          <div class="comment-meta-row">
            <span>${timeAgo}</span>
            <button class="comment-btn-reply" data-author="${escapeHTML(c.usuario)}">Responder</button>
          </div>
        </div>
        <button class="comment-like-btn" data-id="${c.id}" data-likes="${c.likes || 0}">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
          <span class="comment-likes-num">${c.likes || 0}</span>
        </button>
      `;

      const likeBtn = itemEl.querySelector('.comment-like-btn');
      likeBtn.addEventListener('click', async () => {
        const cur = parseInt(likeBtn.dataset.likes, 10) || 0;
        const newLikes = cur + 1;
        likeBtn.dataset.likes = newLikes;
        likeBtn.querySelector('.comment-likes-num').textContent = newLikes;
        likeBtn.classList.add('liked');
        likeBtn.querySelector('svg').setAttribute('fill', 'var(--accent-red)');
        await window.CommentsDB.likeComment(c.id, cur);
      });

      const replyBtn = itemEl.querySelector('.comment-btn-reply');
      replyBtn.addEventListener('click', () => {
        commentTextInput.value = `@${replyBtn.dataset.author} `;
        commentTextInput.focus();
        btnSendComment.disabled = false;
      });

      commentsList.appendChild(itemEl);
    });
  }

  // Enviar comentario real a Supabase
  commentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = commentTextInput.value.trim();
    const user = commentUserHandle.value.trim() || 'Usuario_FilmTV';

    if (!text || !activeMovieIdForComments) return;

    btnSendComment.disabled = true;

    try {
      const added = await window.CommentsDB.addComment(activeMovieIdForComments, user, text);
      if (added) {
        commentTextInput.value = '';
        
        const emptyState = commentsList.querySelector('.comments-empty-state');
        if (emptyState) emptyState.remove();

        const itemEl = document.createElement('div');
        itemEl.className = 'comment-item';
        itemEl.innerHTML = `
          <img src="${added.avatar}" alt="${added.usuario}" class="comment-avatar">
          <div class="comment-content">
            <span class="comment-author">${escapeHTML(added.usuario)}</span>
            <p class="comment-text">${escapeHTML(added.comentario)}</p>
            <div class="comment-meta-row">
              <span>Hace unos segundos</span>
            </div>
          </div>
          <button class="comment-like-btn" data-likes="0">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
            <span class="comment-likes-num">0</span>
          </button>
        `;
        commentsList.prepend(itemEl);

        const currentCount = commentsList.querySelectorAll('.comment-item').length;
        commentsHeaderCount.textContent = `Comentarios (${currentCount})`;
        const badge = document.getElementById(`comment-count-badge-${activeMovieIdForComments}`);
        if (badge) badge.textContent = String(currentCount);

        showToast('Comentario publicado en Supabase');
      }
    } catch (err) {
      console.error('Error publicando comentario:', err);
      showToast('Error al publicar comentario');
    } finally {
      btnSendComment.disabled = false;
    }
  });

  // Alternar panel de comentarios
  function toggleCommentsPanel(open) {
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
      if (open) {
        commentsPanel.classList.add('open-mobile');
        commentsBackdrop.classList.add('show');
      } else {
        commentsPanel.classList.remove('open-mobile');
        commentsBackdrop.classList.remove('show');
      }
    } else {
      if (open) {
        commentsPanel.classList.remove('collapsed');
      } else {
        commentsPanel.classList.add('collapsed');
      }
    }
  }

  btnCloseComments.addEventListener('click', () => toggleCommentsPanel(false));
  commentsBackdrop.addEventListener('click', () => toggleCommentsPanel(false));

  // ==========================================================================
  // REPRODUCTOR DE CINE INTEGRADO (IN-APP CINEMA FULL PLAYER)
  // ==========================================================================
  let currentCinemaHls = null;
  let activeCinemaItem = null;

  function getSectionDisplayName(sec) {
    switch (sec) {
      case 'peliculas': return 'Películas';
      case 'series': return 'Series';
      case 'anime': return 'Anime';
      case 'tdt': return 'TDT';
      case 'free': return 'FREE';
      case 'tvcable': return 'TV Cable';
      default: return 'Para ti';
    }
  }

  function setupCinemaPlayerEvents() {
    if (btnBackToFeed) {
      btnBackToFeed.addEventListener('click', () => {
        closeFullPlayer();
      });
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && document.body.classList.contains('full-player-active')) {
        closeFullPlayer();
      }
    });
  }

  function openFullPlayer(item) {
    if (!item) return;
    activeCinemaItem = item;

    // 1. Pausar y desmontar cualquier trailer que se esté reproduciendo en el feed
    unmountMedia(currentActiveIndex);

    // 2. Activar modo cine en el body (oculta feed, comentarios y flechas)
    document.body.classList.add('full-player-active');
    if (fullPlayerOverlay) {
      fullPlayerOverlay.style.display = 'flex';
      fullPlayerOverlay.scrollTop = 0;
    }

    // 3. Configurar botón de volver dinámico
    if (btnBackToFeedText) {
      btnBackToFeedText.textContent = `Volver a ${getSectionDisplayName(currentSection)}`;
    }

    // 4. Configurar datos de la cabecera y detalles
    const isLive = item.tipo === 'canal' || Boolean(item.streamUrl);
    const catPill = isLive ? 'Canal en Vivo' : (item.tipo === 'serie' ? 'Serie' : (item.tipo === 'anime' ? 'Anime' : 'Película'));

    if (fullPlayerCategoryPill) fullPlayerCategoryPill.textContent = catPill;
    if (fullPlayerHeaderTitle) fullPlayerHeaderTitle.textContent = item.titulo;
    if (fullPlayerTitle) fullPlayerTitle.textContent = item.titulo;
    if (fullPlayerYear) fullPlayerYear.textContent = item.año || '2026';
    if (fullPlayerGenre) fullPlayerGenre.textContent = item.categoria || 'Streaming';
    if (fullPlayerRating) fullPlayerRating.textContent = `★ ${item.valoracion || '8.5'}`;
    if (fullPlayerQuality) fullPlayerQuality.textContent = isLive ? 'Señal en Vivo HD' : '1080p Full HD';
    if (fullPlayerSynopsis) fullPlayerSynopsis.textContent = item.descripcion || 'Sinopsis no disponible.';

    // 5. Botón de compartir
    if (btnShareFullMovie) {
      btnShareFullMovie.onclick = () => {
        const shareUrl = item.urlDestino || window.location.href;
        navigator.clipboard.writeText(shareUrl).then(() => {
          showToast('¡Enlace de streaming copiado!');
        }).catch(() => {
          showToast(shareUrl);
        });
      };
    }

    // 6. Montar el reproductor
    if (isLive) {
      if (fullPlayerServersContainer) fullPlayerServersContainer.style.display = 'none';
      mountCinemaLiveStream(item);
    } else {
      if (fullPlayerServersContainer) fullPlayerServersContainer.style.display = 'flex';
      mountCinemaMultiServer(item);
    }
  }

  function closeFullPlayer() {
    // 1. Limpiar streams/reproductores
    if (currentCinemaHls) {
      try {
        currentCinemaHls.destroy();
      } catch (e) {}
      currentCinemaHls = null;
    }
    if (fullPlayerMediaHost) {
      fullPlayerMediaHost.innerHTML = '';
    }
    if (fullPlayerLoader) {
      fullPlayerLoader.style.display = 'none';
    }

    // 2. Restaurar pantalla normal
    document.body.classList.remove('full-player-active');
    if (fullPlayerOverlay) {
      fullPlayerOverlay.style.display = 'none';
    }

    // 3. Reanudar video activo del feed
    if (currentFeed && currentFeed[currentActiveIndex]) {
      mountActiveMedia(currentActiveIndex);
      loadCommentsForMovie(currentFeed[currentActiveIndex].id);
    }
  }

  function mountCinemaLiveStream(item) {
    if (!fullPlayerMediaHost) return;
    fullPlayerMediaHost.innerHTML = '';

    const streamUrl = item.streamUrl || item.urlDestino || '';

    if (streamUrl.includes('youtube.com') || streamUrl.includes('youtu.be')) {
      let ytId = '';
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|\/live\/)([^#\&\?]*).*/;
      const match = streamUrl.match(regExp);
      if (match && match[2].length === 11) ytId = match[2];

      const iframe = document.createElement('iframe');
      iframe.className = 'cinema-iframe';
      iframe.src = `https://www.youtube.com/embed/${ytId}?autoplay=1&controls=1&rel=0`;
      iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
      iframe.setAttribute('allowfullscreen', 'true');
      fullPlayerMediaHost.appendChild(iframe);
      return;
    }

    const video = document.createElement('video');
    video.className = 'cinema-hls-video';
    video.controls = true;
    video.autoplay = true;
    video.playsInline = true;
    video.poster = item.poster || '';
    fullPlayerMediaHost.appendChild(video);

    if (window.Hls && Hls.isSupported() && streamUrl.includes('.m3u8')) {
      currentCinemaHls = new Hls({ enableWorker: true, lowLatencyMode: true });
      currentCinemaHls.loadSource(streamUrl);
      currentCinemaHls.attachMedia(video);
      currentCinemaHls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {
          video.muted = true;
          video.play().catch(() => {});
        });
      });
      currentCinemaHls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              currentCinemaHls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              currentCinemaHls.recoverMediaError();
              break;
            default:
              currentCinemaHls.destroy();
              break;
          }
        }
      });
    } else {
      video.src = streamUrl;
      video.play().catch(() => {
        video.muted = true;
        video.play().catch(() => {});
      });
    }
  }

  function mountCinemaMultiServer(item) {
    if (!fullPlayerServersList || !fullPlayerMediaHost) return;
    fullPlayerServersList.innerHTML = '';

    const tmdbId = item.tmdbId || (item.id ? item.id.replace(/^(movie-|serie-|anime-)/, '') : '');
    const isSerieOrAnime = (item.tipo === 'serie' || item.tipo === 'anime');

    const servers = [
      {
        id: 'vidsrc',
        name: 'Servidor 1 (VidSrc - Rápido)',
        url: isSerieOrAnime
          ? `https://vidsrc.to/embed/tv/${tmdbId}/1/1`
          : `https://vidsrc.to/embed/movie/${tmdbId}`
      },
      {
        id: 'embedsu',
        name: 'Servidor 2 (Embed.su)',
        url: isSerieOrAnime
          ? `https://embed.su/embed/tv/${tmdbId}/1/1`
          : `https://embed.su/embed/movie/${tmdbId}`
      },
      {
        id: 'vidsrcxyz',
        name: 'Servidor 3 (VidSrc.xyz)',
        url: isSerieOrAnime
          ? `https://vidsrc.xyz/embed/tv?tmdb=${tmdbId}&sea=1&epi=1`
          : `https://vidsrc.xyz/embed/movie?tmdb=${tmdbId}`
      },
      {
        id: 'smashy',
        name: 'Servidor 4 (SmashyStream)',
        url: isSerieOrAnime
          ? `https://embed.smashystream.com/playere.php?tmdb=${tmdbId}&season=1&episode=1`
          : `https://embed.smashystream.com/playere.php?tmdb=${tmdbId}`
      }
    ];

    servers.forEach((srv, idx) => {
      const btn = document.createElement('button');
      btn.className = `server-pill ${idx === 0 ? 'active' : ''}`;
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
          <polygon points="5 3 19 12 5 21 5 3"></polygon>
        </svg>
        <span>${srv.name}</span>
      `;
      btn.addEventListener('click', () => {
        fullPlayerServersList.querySelectorAll('.server-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        loadCinemaEmbed(srv.url);
      });
      fullPlayerServersList.appendChild(btn);
    });

    loadCinemaEmbed(servers[0].url);
  }

  function loadCinemaEmbed(url) {
    if (!fullPlayerMediaHost) return;
    fullPlayerMediaHost.innerHTML = '';

    if (fullPlayerLoader) {
      fullPlayerLoader.style.display = 'flex';
    }

    const iframe = document.createElement('iframe');
    iframe.className = 'cinema-iframe';
    iframe.src = url;
    iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen');
    iframe.setAttribute('allowfullscreen', 'true');

    iframe.onload = () => {
      if (fullPlayerLoader) fullPlayerLoader.style.display = 'none';
    };

    setTimeout(() => {
      if (fullPlayerLoader) fullPlayerLoader.style.display = 'none';
    }, 2800);

    fullPlayerMediaHost.appendChild(iframe);
  }

  // ==========================================================================
  // BÚSQUEDA UNIVERSAL (CATÁLOGO COMPLETO + TMDB API)
  // ==========================================================================
  let searchDebounceTimer = null;
  let activeSearchQueryId = 0;

  function setupSearch() {
    searchInput.addEventListener('input', () => {
      const q = searchInput.value;
      btnClearSearch.style.display = q.trim() ? 'flex' : 'none';

      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => {
        performGlobalSearch(q);
      }, 260);
    });

    btnClearSearch.addEventListener('click', () => {
      clearTimeout(searchDebounceTimer);
      searchInput.value = '';
      btnClearSearch.style.display = 'none';
      switchSection(currentSection);
    });

    if (btnMobileSearch) {
      btnMobileSearch.addEventListener('click', () => {
        const q = prompt('Buscar película, serie, anime o canal de TV:');
        if (q) {
          searchInput.value = q;
          const event = new Event('input');
          searchInput.dispatchEvent(event);
        }
      });
    }
  }

  function performGlobalSearch(query) {
    const currentQueryId = ++activeSearchQueryId;
    const cleanQ = query.trim();

    if (!cleanQ) {
      switchSection(currentSection);
      return;
    }

    const qLower = cleanQ.toLowerCase();
    const localMatches = [];
    const seenIds = new Set();

    // 1. Búsqueda local inmediata en todas las secciones
    if (window.CATALOG) {
      Object.keys(window.CATALOG).forEach((sec) => {
        const list = window.CATALOG[sec] || [];
        list.forEach((item) => {
          if (!seenIds.has(item.id)) {
            const titleMatch = item.titulo && item.titulo.toLowerCase().includes(qLower);
            const catMatch = item.categoria && item.categoria.toLowerCase().includes(qLower);
            const descMatch = item.descripcion && item.descripcion.toLowerCase().includes(qLower);
            if (titleMatch || catMatch || descMatch) {
              seenIds.add(item.id);
              localMatches.push(item);
            }
          }
        });
      });
    }

    // Si hay coincidencias locales, renderizarlas de inmediato
    if (localMatches.length > 0) {
      currentFeed = [...localMatches];
      feedContainer.scrollTop = 0;
      currentActiveIndex = 0;
      renderFeed(currentFeed);
      setupScrollObserver();
      updateFloatingArrowsState();
      mountActiveMedia(0);
      loadCommentsForMovie(currentFeed[0].id);
    }

    // 2. Consulta a TMDB API si tiene al menos 2 caracteres
    if (cleanQ.length >= 2) {
      const apiKey = window.TMDB_API_KEY || '04c35731a5ee918f014970082a0088b1';
      const searchUrl = `https://api.themoviedb.org/3/search/multi?api_key=${apiKey}&language=es-MX&query=${encodeURIComponent(cleanQ)}&page=1&include_adult=false`;

      fetch(searchUrl)
        .then(res => res.json())
        .then(async (data) => {
          if (currentQueryId !== activeSearchQueryId) return;

          const tmdbResults = (data.results || [])
            .filter(r => (r.media_type === 'movie' || r.media_type === 'tv') && (r.title || r.name))
            .slice(0, 10);

          // Buscar tráilers en paralelo para los resultados de TMDB
          const mappedTmdbItems = await Promise.all(tmdbResults.map(async (r) => {
            const isTv = r.media_type === 'tv';
            const tmdbId = String(r.id);
            const internalId = isTv ? `serie-${tmdbId}` : `movie-${tmdbId}`;

            let trailerKey = null;
            try {
              // 1. Tráiler en español
              const vRes = await fetch(`https://api.themoviedb.org/3/${r.media_type}/${tmdbId}/videos?api_key=${apiKey}&language=es-MX`);
              const vData = await vRes.json();
              trailerKey = (vData.results && vData.results.find(v => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser')) || {}).key;

              // 2. Fallback tráiler en inglés si no hay en español
              if (!trailerKey) {
                const vResEn = await fetch(`https://api.themoviedb.org/3/${r.media_type}/${tmdbId}/videos?api_key=${apiKey}&language=en-US`);
                const vDataEn = await vResEn.json();
                trailerKey = (vDataEn.results && vDataEn.results.find(v => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser')) || {}).key;
              }
            } catch (e) {}

            return {
              id: internalId,
              tmdbId: tmdbId,
              seccion: isTv ? 'series' : 'peliculas',
              tipo: isTv ? 'serie' : 'pelicula',
              titulo: r.title || r.name,
              descripcion: r.overview || 'Sinopsis en proceso de actualización.',
              categoria: isTv ? 'Serie' : 'Película',
              año: (r.release_date || r.first_air_date || '2026').slice(0, 4),
              valoracion: r.vote_average ? r.vote_average.toFixed(1) : '7.5',
              poster: r.poster_path ? `https://image.tmdb.org/t/p/w500${r.poster_path}` : 'https://image.tmdb.org/t/p/w500/3AxfnEViGaVspgifEag5au5bVJc.jpg',
              trailerKey: trailerKey || '',
              urlDestino: `https://filtv.bytelog.lat/${isTv ? 'serie' : 'pelicula'}/${tmdbId}`,
              btnTexto: isTv ? 'Ver Serie Completa' : 'Ver Película Completa',
              likesCount: 0,
              savesCount: 0,
              sharesCount: 0
            };
          }));

          if (currentQueryId !== activeSearchQueryId) return;

          // Combinar resultados locales + TMDB evitando duplicados
          const combined = [...localMatches];
          mappedTmdbItems.forEach((tmdbItem) => {
            if (!seenIds.has(tmdbItem.id)) {
              seenIds.add(tmdbItem.id);
              combined.push(tmdbItem);
            }
          });

          currentFeed = combined;
          feedContainer.scrollTop = 0;
          currentActiveIndex = 0;

          if (currentFeed.length === 0) {
            feedContainer.innerHTML = `
              <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; color:#888; text-align:center; padding:20px;">
                <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="#666" stroke-width="1.8" style="margin-bottom:16px;">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <p style="font-size:18px; color:#fff; font-weight:700; margin-bottom:8px;">No se encontraron resultados para "${escapeHTML(cleanQ)}"</p>
                <p style="font-size:13px; color:#888; margin-bottom:18px;">Intenta con otro título de película, serie, anime o canal de TV.</p>
                <button id="btnEmptySearchBack" style="background:linear-gradient(135deg, #ffd700 0%, #ffa500 100%); color:#000; border:none; padding:10px 22px; border-radius:8px; font-weight:800; cursor:pointer;">Volver a Para ti</button>
              </div>
            `;
            const btnBack = document.getElementById('btnEmptySearchBack');
            if (btnBack) {
              btnBack.addEventListener('click', () => {
                searchInput.value = '';
                btnClearSearch.style.display = 'none';
                switchSection('para_ti');
              });
            }
            return;
          }

          renderFeed(currentFeed);
          setupScrollObserver();
          updateFloatingArrowsState();
          mountActiveMedia(0);
          loadCommentsForMovie(currentFeed[0].id);
        })
        .catch(err => {
          console.error('Error buscando en TMDB:', err);
        });
    }
  }

  // ==========================================================================
  // UTILIDADES
  // ==========================================================================
  function showToast(message) {
    toastMsg.textContent = message;
    toastNotice.classList.add('show');
    setTimeout(() => {
      toastNotice.classList.remove('show');
    }, 2800);
  }

  function formatTimeAgo(isoString) {
    if (!isoString) return 'Hace un momento';
    const seconds = Math.floor((new Date() - new Date(isoString)) / 1000);
    if (seconds < 60) return 'Hace un momento';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `Hace ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Hace ${hours} h`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `Hace ${days} d`;
    return 'Hace un tiempo';
  }

  function escapeHTML(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  document.addEventListener('DOMContentLoaded', initApp);
})();
