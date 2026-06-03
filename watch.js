/*!
 * Watch Page JS - Centralized Template v1.0
 * يبني كامل صفحة المشاهدة ديناميكياً
 */
console.log('watch.js executing - start');
(function () {
  'use strict';

  /* =========================================================
     0. CONFIG
  ========================================================= */
  var CONFIG = {
    ANIME_NAME: '', EPISODE_NUM: '', PAGE_TYPE: 'free',
    IS_MOVIE: false, MAIN_API_URL: '', NAV_API_URL: '',
    UPGRADE_URL: '', POSTER_URL: '', PRIVACY_URL: '',
    DISCLAIMER_URL: '', TERMS_URL: '', CONTACT_URL: '',
    REPORT_URL: '', PAGE_TITLE: '',
    CACHE_TTL: 5 * 60 * 1000, EPISODE_NUM_NORMALIZED: ''
  };

  /* =========================================================
     1. HELPERS
  ========================================================= */
  var normalizeEpisode = function (ep) {
    if (!ep) return '';
    var num = parseInt(ep.toString().trim(), 10);
    return isNaN(num) ? ep.toString().trim() : num.toString();
  };
  var safeText = function (text, fallback) {
    fallback = fallback || '--';
    if (text === null || text === undefined || text === 'null' || text === 'undefined') return fallback;
    var t = String(text).trim();
    return t !== '' ? t : fallback;
  };
  var isValidUrl = function (url) {
    if (!url || typeof url !== 'string') return false;
    try { new URL(url.startsWith('http') ? url : 'https://' + url); return true; } catch (e) { return false; }
  };
  var normalizeUrl = function (url) {
    return !url ? '' : (url.startsWith('http') ? url : 'https://' + url);
  };
  var getSeasonsWord = function (count) {
    count = parseInt(count) || 1;
    if (count === 1 || count === 2) return 'موسم';
    if (count >= 3 && count <= 10) return 'مواسم';
    return 'موسم';
  };
  var fmt2 = function (num) {
    return (parseInt(num) || 0).toString().padStart(2, '0');
  };
  var isNonDesktop = function () { return window.innerWidth <= 1024; };

  /* =========================================================
     2. SERVICE COLORS
  ========================================================= */
  var _defCounter = 0, _svcMap = {};
  var resetServiceColors = function () { _defCounter = 0; _svcMap = {}; };
  var getServiceClass = function (name) {
    if (!name) { _defCounter++; return 'default-' + ((_defCounter - 1) % 6 + 1); }
    var n = name.toLowerCase();
    if (n.indexOf('drive') !== -1 || n.indexOf('google') !== -1) return 'drive';
    if (n.indexOf('mega') !== -1) return 'mega';
    if (n.indexOf('dood') !== -1) return 'dood';
    if (n.indexOf('streamtape') !== -1) return 'streamtape';
    if (!_svcMap[n]) { var k = Object.keys(_svcMap).length; _svcMap[n] = 'default-' + (k % 6 + 1); }
    return _svcMap[n];
  };
  var getIconForService = function (svc) {
    var base = svc.replace(/-\d+$/, '');
    return { drive: 'fa-brands fa-google-drive', mega: 'fa-solid fa-cloud', dood: 'fa-solid fa-video', streamtape: 'fa-solid fa-tape' }[base] || 'fa-solid fa-play';
  };
  var createServiceBtn = function (item, type) {
    if (!item || !item.url) return '';
    var svc = getServiceClass(item.name);
    var url = normalizeUrl(item.url).replace(/"/g, '&quot;');
    var nm = safeText(item.name);
    if (type === 'server') {
      return '<button class="server-btn" data-service="' + svc + '" data-url="' + url + '" onclick="__WatchApp.selectServer(this)"><i class="' + getIconForService(svc) + '"></i><span>' + nm + '</span></button>';
    }
    return '<a class="download-btn" data-service="' + svc + '" href="' + url + '" target="_blank" rel="noopener noreferrer"><i class="fas fa-download"></i><span>' + nm + '</span></a>';
  };

  /* =========================================================
     3. CACHE
  ========================================================= */
  var Cache = {
    get: function (k) {
      try {
        var r = localStorage.getItem(k);
        if (!r) return null;
        var p = JSON.parse(r);
        if (Date.now() - p.timestamp > CONFIG.CACHE_TTL) { localStorage.removeItem(k); return null; }
        return p.data;
      } catch (e) { return null; }
    },
    set: function (k, d) {
      try { localStorage.setItem(k, JSON.stringify({ data: d, timestamp: Date.now() })); } catch (e) {}
    }
  };

  /* =========================================================
     4. API
  ========================================================= */
  function fetchMain(anime, ep, nep) {
    var ck = 'anime:getAll:' + anime + ':' + ep + ':' + CONFIG.PAGE_TYPE;
    var cached = Cache.get(ck);
    if (cached) return Promise.resolve(cached);
    var url = new URL(CONFIG.MAIN_API_URL);
    url.searchParams.append('action', 'getAll');
    url.searchParams.append('anime', anime);
    url.searchParams.append('episode', ep);
    url.searchParams.append('normalizedEp', nep);
    url.searchParams.append('tier', CONFIG.PAGE_TYPE);
    url.searchParams.append('_t', Date.now());
    return new Promise(function (resolve) {
      var ctrl = new AbortController();
      var t = setTimeout(function () { ctrl.abort(); }, 15000);
      fetch(url.toString(), { method: 'GET', signal: ctrl.signal, mode: 'cors', credentials: 'omit', cache: 'no-store' })
        .then(function (r) { clearTimeout(t); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(function (d) { if (d && !d.error) Cache.set(ck, d); resolve(d); })
        .catch(function (e) { clearTimeout(t); resolve({ error: true, message: e.message }); });
    });
  }
  function fetchNav(anime, ep) {
    if (!CONFIG.NAV_API_URL) return Promise.resolve({ previous: '', next: '' });
    var ck = 'nav:' + anime + ':' + ep + ':' + CONFIG.PAGE_TYPE + ':' + CONFIG.IS_MOVIE;
    var cached = Cache.get(ck);
    if (cached) return Promise.resolve(cached);
    var url = new URL(CONFIG.NAV_API_URL);
    url.searchParams.append('action', 'getNav');
    url.searchParams.append('anime', anime);
    url.searchParams.append('episode', ep);
    url.searchParams.append('type', CONFIG.PAGE_TYPE);
    url.searchParams.append('isMovie', CONFIG.IS_MOVIE ? 'true' : 'false');
    url.searchParams.append('_t', Date.now());
    return new Promise(function (resolve) {
      var ctrl = new AbortController();
      var t = setTimeout(function () { ctrl.abort(); }, 12000);
      fetch(url.toString(), { method: 'GET', signal: ctrl.signal, mode: 'cors', credentials: 'omit', cache: 'no-store' })
        .then(function (r) { clearTimeout(t); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(function (d) { if (d && !d.error) Cache.set(ck, d); resolve(d); })
        .catch(function (e) { clearTimeout(t); resolve({ previous: '', next: '' }); });
    });
  }

  /* =========================================================
     5. BUILD HTML
  ========================================================= */
  function buildHTML() {
    var app = document.getElementById('watch-app');
    if (!app) return;
    app.innerHTML = [
      '<div class="notifications-bar" id="notificationsBar"></div>',

      '<header class="main-header" id="mainHeader">',
      '  <div class="header-title">',
      '    <span class="header-anime-name" id="headerAnimeName"><span class="skeleton skeleton-title"></span></span>',
      '  </div>',
      '  <div class="header-center">',
      '    <button class="nav-btn" id="prevEpisode" disabled><i class="fas fa-chevron-right"></i></button>',
      '    <span class="episode-pill">EP <span id="headerEpisodeNum">--</span></span>',
      '    <button class="nav-btn" id="nextEpisode" disabled><i class="fas fa-chevron-left"></i></button>',
      '  </div>',
      '  <div class="header-actions">',
      '    <button class="btn watch-mode-btn" id="watchModeToggle"><i class="fas fa-eye"></i><span>وضع المشاهدة</span></button>',
      '  </div>',
      '</header>',

      '<main class="main-content" id="mainContent">',

      /* anime grid */
      '  <section class="anime-grid watch-mode-hide" id="animeGridSection">',
      '    <div class="poster-section">',
      '      <div class="poster-container">',
      '        <img src="" alt="" class="poster-image-new" id="newPosterImage">',
      '        <div class="poster-loader" id="posterLoader"></div>',
      '        <div class="poster-error" id="posterError" style="display:none"><span>الصورة غير متوفرة</span></div>',
      '      </div>',
      '    </div>',
      '    <article class="unified-card elevated anime-info" data-loaded="false">',
      '      <div class="skeleton skeleton-title" style="width:80%"></div>',
      '      <div class="skeleton skeleton-text" style="width:90%"></div>',
      '      <div class="skeleton skeleton-text" style="width:70%"></div>',
      '      <div class="loading-overlay active" id="animeInfoLoading"><span class="loading-overlay-text">جاري تحميل البيانات…</span></div>',
      '      <div class="content">',
      '        <div class="anime-meta-section">',
      '          <div class="anime-name-row">',
      '            <a href="#" class="anime-name-link" id="animeNameLink" target="_blank" rel="noopener"></a>',
      '            <a href="https://zeroanime-premium.blogspot.com/p/watching-order" class="watching-order-btn" id="watchingOrderBtn" target="_blank" rel="noopener">',
      '              <i class="fas fa-list-ol"></i><span>ترتيب المشاهدة</span>',
      '            </a>',
      '          </div>',
      '          <div class="anime-story-section">',
      '            <h4 class="story-title"><i class="fas fa-book-open"></i> القصة</h4>',
      '            <div class="anime-desc-wrapper">',
      '              <p class="anime-desc" id="animeDescription"></p>',
      '              <button class="read-more-btn" id="readMoreBtn"><span id="readMoreText">قراءة المزيد</span><i class="fas fa-chevron-down"></i></button>',
      '            </div>',
      '          </div>',
      '          <div class="anime-stats-inline">',
      '            <div class="anime-stat-inline" id="yearStatWrap" style="display:none"><i class="fas fa-calendar-alt"></i><span>السنة: <strong id="animeYear">--</strong></span></div>',
      '            <div class="anime-stat-inline"><i class="fas fa-tv"></i><span>النوع: <strong id="animeType">--</strong></span></div>',
      '            <div class="anime-stat-inline"><i class="fas fa-layer-group"></i><span><strong id="seasonsCount">1</strong> <span id="seasonsWord">موسم</span></span></div>',
      '            <div class="anime-stat-inline"><span class="status-dot-inline" id="statusDot"></span><span>الحالة: <strong id="animeStatus">--</strong></span></div>',
      '          </div>',
      '          <nav class="rating-links">',
      '            <a href="#" class="rating-link" id="imdbLink" target="_blank" rel="noopener" style="display:none" data-service="imdb"><i class="fab fa-imdb"></i> IMDb</a>',
      '            <a href="#" class="rating-link" id="malLink"  target="_blank" rel="noopener" style="display:none" data-service="mal"><i class="fas fa-book-open"></i> MAL</a>',
      '          </nav>',
      '        </div>',
      '        <div class="episode-meta-section">',
      '          <div class="episode-meta-item"><i class="fas fa-hashtag"></i><span class="meta-label">الحلقة:</span><span class="meta-value" id="episodeNumberDisplay">--</span></div>',
      '          <div class="episode-meta-item"><i class="fas fa-list-ol"></i><span class="meta-label">ترتيب في الموسم:</span><span class="meta-value" id="episodeInSeason">--</span></div>',
      '          <div class="episode-meta-item"><i class="fas fa-language"></i><span class="meta-label">عنوان عربي:</span><span class="meta-value" id="episodeTitleAr">--</span></div>',
      '          <div class="episode-meta-item"><i class="fas fa-globe"></i><span class="meta-label">عنوان إنجليزي:</span><span class="meta-value" id="episodeTitleEn">--</span></div>',
      '          <div class="episode-meta-item"><i class="fas fa-video"></i><span class="meta-label">الجودة:</span><span class="meta-value" id="episodeQuality">--</span></div>',
      '          <div class="episode-meta-item"><i class="fas fa-clock"></i><span class="meta-label">المدة:</span><span class="meta-value" id="episodeDuration">--</span></div>',
      '          <nav class="episode-rating-links">',
      '            <a href="#" class="episode-rating-link" id="episodeImdb" target="_blank" data-service="imdb" style="display:none"><i class="fab fa-imdb"></i> IMDb</a>',
      '            <a href="#" class="episode-rating-link" id="episodeMal"  target="_blank" data-service="mal"  style="display:none"><i class="fas fa-book-open"></i> MAL</a>',
      '          </nav>',
      '        </div>',
      '      </div>',
      '    </article>',
      '  </section>',

      /* player */
      '  <section class="player-section" data-loaded="false">',
      '    <div class="loading-overlay active" id="playerSectionLoading"><span class="loading-overlay-text">جاري التحميل…</span></div>',
      '    <div class="content">',
      '      <div class="player-container" id="playerContainer">',
      '        '        <iframe id="videoPlayer" src=""',
'          allow="autoplay; encrypted-media; fullscreen *; picture-in-picture; clipboard-write; web-share"',
'          allowfullscreen="true" webkitallowfullscreen="true" mozallowfullscreen="true"',
'          frameborder="0" scrolling="no"',
'          referrerpolicy="no-referrer-when-downgrade" loading="lazy" style="opacity:0;pointer-events:none;"></iframe>',
      '        <div class="player-placeholder" id="playerPlaceholder">',
      '          <div class="player-placeholder-icon"><i class="fas fa-play"></i></div>',
      '          <div class="player-placeholder-text">اضغط لاختيار سيرفر للمشاهدة</div>',
      '          <div class="player-placeholder-subtext">سيتم نقلك تلقائياً لأسفل لاختيار الخادم المناسب</div>',
      '        </div>',
      '      </div>',
      '      <div class="player-nav-bar">',
      '        <button class="nav-btn-large" id="prevEpisodeBottom" disabled><i class="fas fa-chevron-right"></i></button>',
      '        <button class="nav-btn-large" id="nextEpisodeBottom" disabled><i class="fas fa-chevron-left"></i></button>',
      '      </div>',
      '      <div class="servers-section" id="serversSection">',
      '        <h3 class="section-title"><i class="fas fa-play-circle"></i> خوادم المشاهدة</h3>',
      '        <div class="servers-grid" id="serversGrid"></div>',
      '      </div>',
      '      <div class="downloads-section watch-mode-hide" id="downloadsSection">',
      '        <h3 class="section-title"><i class="fas fa-download"></i> روابط التحميل</h3>',
      '        <div class="downloads-grid" id="downloadsGrid"></div>',
      '      </div>',
      '    </div>',
      '  </section>',

      /* seasons */
      '  <section class="unified-card elevated seasons-section" data-loaded="false">',
      '    <div class="skeleton skeleton-title" style="width:40%"></div>',
      '    <div style="display:flex;gap:8px"><div class="skeleton" style="height:32px;width:80px;border-radius:999px"></div><div class="skeleton" style="height:32px;width:80px;border-radius:999px"></div></div>',
      '    <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:8px">',
      '      <div class="skeleton skeleton-btn"></div><div class="skeleton skeleton-btn"></div>',
      '      <div class="skeleton skeleton-btn"></div><div class="skeleton skeleton-btn"></div>',
      '      <div class="skeleton skeleton-btn"></div><div class="skeleton skeleton-btn"></div>',
      '    </div>',
      '    <div class="loading-overlay active" id="seasonsSectionLoading"><span class="loading-overlay-text">جاري تحميل البيانات…</span></div>',
      '    <div class="content">',
      '      <div class="seasons-header-new">',
      '        <h3 class="seasons-title-new"><i class="fas fa-list-ol"></i> المواسم والحلقات</h3>',
      '        <div class="seasons-selector-new" id="newSeasonsSelector"></div>',
      '      </div>',
      '      <div class="season-content-wrapper" id="seasonContentWrapper">',
      '        <div class="season-content-new" id="seasonContentNew">',
      '          <div class="season-header-card"><span class="season-info-text" id="seasonInfoText"></span></div>',
      '          <div class="episodes-grid-new" id="newEpisodesGrid" style="overflow:visible;"></div>',
      '        </div>',
      '      </div>',
      '      <div class="seasons-action-btns" id="seasonsActionBtns" style="display:none;">',
      '        <a href="#" class="all-versions-btn-seasons" id="allVersionsBtnSeasons" target="_blank" rel="noopener"><i class="fas fa-film"></i> جميع إصدارات الأنمي</a>',
      '      </div>',
      '    </div>',
      '  </section>',

      /* footer */
      '  <section class="legal-footer watch-mode-hide">',
      '    <p class="copyright-text">© جميع الحقوق محفوظة لأصحاب الأعمال الأصلية، ودورنا يقتصر على إعادة الإنتاج والنشر لندرة التوافر على الإنترنت</p>',
      '    <div class="links-grid">',
      '      <a href="" class="link-btn" id="privacyLink" target="_self"><i class="fas fa-shield-alt"></i> سياسة الخصوصية</a>',
      '      <a href="" class="link-btn" id="dmcaLink"    target="_self"><i class="fas fa-gavel"></i> DMCA</a>',
      '      <a href="" class="link-btn" id="termsLink"   target="_self"><i class="fas fa-file-contract"></i> Terms of Use</a>',
      '      <a href="" class="link-btn" id="contactLink" target="_self"><i class="fas fa-envelope"></i> تواصل معنا</a>',
      '    </div>',
      '  </section>',

      '  <section class="report-section watch-mode-hide">',
      '    <a href="" class="report-btn" id="reportBtn" target="_blank" rel="noopener"><i class="fas fa-exclamation-triangle"></i> تبليغ عن مشكلة</a>',
      '  </section>',

      '</main>',

      /* floating */
      '<button class="watch-mode-floating" id="watchModeFloating">',
      '  <i class="fas fa-compress-alt wm-icon"></i><span id="watchModeText">وضع المشاهدة</span>',
      '</button>',
      '<a href="#" class="upgrade-floating" id="upgradeFloating" target="_blank" rel="noopener">',
      '  <i class="fas fa-crown"></i><span>ترقية</span>',
      '</a>'
    ].join('\n');
  }

  /* =========================================================
     6. DOM REFS
  ========================================================= */
  var D = {};
  function cacheDOM() {
    var ids = [
      'notificationsBar','mainHeader','headerAnimeName','newPosterImage','posterLoader','posterError',
      'animeInfoLoading','animeNameLink','watchingOrderBtn','animeType','animeYear','yearStatWrap',
      'seasonsCount','seasonsWord','statusDot','animeStatus','animeDescription','readMoreBtn','readMoreText',
      'imdbLink','malLink','episodeNumberDisplay','episodeInSeason','episodeTitleAr','episodeTitleEn',
      'episodeDuration','episodeQuality','episodeImdb','episodeMal','playerSectionLoading','playerContainer',
      'videoPlayer','playerPlaceholder','serversSection','serversGrid','downloadsGrid',
      'prevEpisode','nextEpisode','prevEpisodeBottom','nextEpisodeBottom',
      'newSeasonsSelector','seasonContentWrapper','seasonContentNew','newEpisodesGrid','seasonInfoText',
      'seasonsActionBtns','allVersionsBtnSeasons','seasonsSectionLoading',
      'watchModeToggle','watchModeFloating','watchModeText','upgradeFloating',
      'mainContent','reportBtn','privacyLink','dmcaLink','termsLink','contactLink','headerEpisodeNum'
    ];
    ids.forEach(function (id) { D[id] = document.getElementById(id); });
    D.animeInfoCard   = document.querySelector('.anime-info');
    D.playerSection   = document.querySelector('.player-section');
    D.seasonsSection  = document.querySelector('.seasons-section');
  }

  /* =========================================================
     7. STATE
  ========================================================= */
  var State = {
    watchMode: false, currentSeason: 1,
    data: { anime: null, episode: null, seasons: [], notifications: [], navigation: null, allEpisodes: [] },
    isLoading: false, posterLoaded: false, dataLoaded: false, seasonSwitching: false
  };

  /* =========================================================
     8. RENDER HELPERS
  ========================================================= */
  function buildSeasonInfoHTML(sNum, sStart, sEnd, eCount) {
    var html = '<span class="s-label">الموسم</span> <span class="s-num">' + fmt2(sNum) + '</span>';
    if (eCount && parseInt(eCount) > 0) {
      html += ' <span class="s-dot">•</span> <span class="s-label">عدد الحلقات:</span> <span class="s-count">' + eCount + '</span>';
    }
    if (sEnd) html += ' <span class="s-dot">•</span> <span class="s-range">(' + fmt2(sStart) + ' - ' + fmt2(sEnd) + ')</span>';
    return html;
  }

  function checkAllLoaded() {
    if (!State.posterLoaded || !State.dataLoaded) return;
    ['animeInfoLoading','playerSectionLoading','seasonsSectionLoading','posterLoader'].forEach(function (id) {
      if (D[id]) D[id].classList.remove('active');
    });
  }

  function scrollToEl(el) {
    if (!el) return;
    var h = D.mainHeader ? D.mainHeader.offsetHeight : 0;
    var top = window.scrollY + el.getBoundingClientRect().top - h - 12;
    window.scrollTo({ top: top, behavior: 'smooth' });
  }

  /* =========================================================
     9. RENDER NOTIFICATIONS
  ========================================================= */
  function renderNotifications(notifications) {
    if (!D.notificationsBar) return;
    if (!Array.isArray(notifications) || !notifications.length) {
      D.notificationsBar.style.display = 'none'; D.notificationsBar.innerHTML = ''; return;
    }
    D.notificationsBar.classList.add('visible');
    D.notificationsBar.innerHTML = notifications.map(function (n) {
      var tc = n.type === 'تحذير' ? 'warning' : (n.type === 'تنبيه' ? 'info' : '');
      var ic = n.type === 'تحذير' ? 'exclamation-triangle' : (n.type === 'تنبيه' ? 'bell' : 'info-circle');
      var close = n.closable ? '<button class="notification-close" onclick="this.closest(\'.notification\').remove()"><i class="fas fa-times"></i> إغلاق</button>' : '';
      var link = (n.buttonLink && isValidUrl(n.buttonLink)) ? '<a class="notification-link-btn" href="' + normalizeUrl(n.buttonLink) + '" target="_blank" rel="noopener"><i class="fas fa-external-link-alt"></i> الرابط</a>' : '';
      return '<div class="notification ' + tc + '">' + close + '<div class="notification-icon"><i class="fas fa-' + ic + '"></i></div><div class="notification-body"><div class="notification-msg">' + safeText(n.message) + '</div>' + link + '</div></div>';
    }).join('');
  }

  /* =========================================================
     10. RENDER ANIME INFO
  ========================================================= */
  function renderAnimeInfo(anime) {
    if (!anime || anime.error) return;
    var name = safeText(anime.name, CONFIG.ANIME_NAME);

    if (D.headerAnimeName) { D.headerAnimeName.innerHTML = '<span class="content">' + name + '</span>'; D.headerAnimeName.title = name; }
    if (D.animeNameLink)   { D.animeNameLink.textContent = name; D.animeNameLink.href = (anime.pageLink && isValidUrl(anime.pageLink)) ? normalizeUrl(anime.pageLink) : '#'; }

    if (D.allVersionsBtnSeasons && D.seasonsActionBtns) {
      var url = anime.allReleasesUrl && isValidUrl(anime.allReleasesUrl) ? normalizeUrl(anime.allReleasesUrl) : '';
      if (url) { D.allVersionsBtnSeasons.href = url; D.seasonsActionBtns.style.display = 'flex'; }
      else { D.seasonsActionBtns.style.display = 'none'; }
    }

    if (D.animeYear && D.yearStatWrap) {
      var yr = safeText(anime.year);
      D.animeYear.textContent = yr;
      D.yearStatWrap.style.display = yr !== '--' ? 'flex' : 'none';
    }
    if (D.animeType) {
      var t = safeText(anime.type);
      D.animeType.textContent = t;
      var p = D.animeType.closest('.anime-stat-inline');
      if (p) p.style.display = t !== '--' ? 'flex' : 'none';
    }
    if (D.seasonsCount) {
      var c = anime.seasonsCount !== undefined && anime.seasonsCount !== '' ? anime.seasonsCount : '1';
      D.seasonsCount.textContent = c;
      if (D.seasonsWord) D.seasonsWord.textContent = getSeasonsWord(c);
    }
    if (D.animeStatus) {
      var s = safeText(anime.status);
      D.animeStatus.textContent = s;
      if (D.statusDot) {
        D.statusDot.className = 'status-dot-inline';
        if (['مستمر','ongoing','Ongoing'].indexOf(s) !== -1) D.statusDot.classList.add('active');
        else if (['منتهي','completed','Completed'].indexOf(s) !== -1) D.statusDot.classList.add('completed');
      }
    }
    if (D.animeDescription) { D.animeDescription.textContent = safeText(anime.info, 'لا يوجد وصف'); setTimeout(initReadMore, 80); }
    if (D.imdbLink) { var iu = anime.imdb && isValidUrl(anime.imdb) ? normalizeUrl(anime.imdb) : ''; D.imdbLink.href = iu || '#'; D.imdbLink.style.display = iu ? 'inline-flex' : 'none'; }
    if (D.malLink)  { var mu = anime.mal  && isValidUrl(anime.mal)  ? normalizeUrl(anime.mal)  : ''; D.malLink.href  = mu || '#'; D.malLink.style.display  = mu ? 'inline-flex' : 'none'; }
  }

  /* =========================================================
     11. RENDER EPISODE INFO
  ========================================================= */
  function renderEpisodeInfo(episode) {
    if (!episode || !D.playerSection) return;
    if (episode.error) {
      if (D.serversGrid)   D.serversGrid.innerHTML   = '<div style="grid-column:1/-1;text-align:center;padding:20px;color:var(--text-muted)">⚠️ تعذر تحميل بيانات الحلقة</div>';
      if (D.downloadsGrid) D.downloadsGrid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:20px;color:var(--text-muted)">لا توجد روابط تحميل</div>';
      D.playerSection.setAttribute('data-loaded', 'true'); return;
    }

    ['headerEpisodeNum','episodeNumberDisplay'].forEach(function (id) { if (D[id]) D[id].textContent = CONFIG.EPISODE_NUM || '--'; });
    if (D.episodeInSeason) D.episodeInSeason.textContent = safeText(episode.orderInSeason);
    if (D.episodeTitleAr)  D.episodeTitleAr.textContent  = safeText(episode.titleAr);
    if (D.episodeTitleEn)  D.episodeTitleEn.textContent  = safeText(episode.titleEn);
    if (D.episodeQuality)  { var q = safeText(episode.quality);  D.episodeQuality.textContent = q;  var pq = D.episodeQuality.closest('.episode-meta-item');  if (pq) pq.style.display = q  !== '--' ? 'flex' : 'none'; }
    if (D.episodeDuration) { var dr = safeText(episode.duration); D.episodeDuration.textContent = dr; var pd = D.episodeDuration.closest('.episode-meta-item'); if (pd) pd.style.display = dr !== '--' ? 'flex' : 'none'; }
    if (D.episodeImdb) { var ei = episode.imdb && isValidUrl(episode.imdb) ? normalizeUrl(episode.imdb) : ''; D.episodeImdb.href = ei || '#'; D.episodeImdb.style.display = ei ? 'inline-flex' : 'none'; }
    if (D.episodeMal)  { var em = episode.mal  && isValidUrl(episode.mal)  ? normalizeUrl(episode.mal)  : ''; D.episodeMal.href  = em || '#'; D.episodeMal.style.display  = em ? 'inline-flex' : 'none'; }

    /* poster */
    if (D.newPosterImage && D.posterLoader && D.posterError) {
      var img = D.newPosterImage, loader = D.posterLoader, err = D.posterError;
      img.classList.remove('loaded'); img.style.opacity = '0'; loader.classList.add('active');
      err.style.display = 'none'; img.style.display = 'block'; img.src = '';
      if (CONFIG.POSTER_URL) {
        img.onload  = function () { loader.classList.remove('active'); img.style.opacity = '1'; img.classList.add('loaded'); State.posterLoaded = true; checkAllLoaded(); };
        img.onerror = function () { loader.classList.remove('active'); img.style.display = 'none'; err.style.display = 'flex'; State.posterLoaded = true; checkAllLoaded(); };
        img.src = CONFIG.POSTER_URL + (CONFIG.POSTER_URL.indexOf('?') === -1 ? '?v=' : '&v=') + Date.now();
      } else {
        loader.classList.remove('active'); img.style.display = 'none'; err.style.display = 'flex';
        State.posterLoaded = true; checkAllLoaded();
      }
    }

    /* servers */
    resetServiceColors();
    if (D.serversGrid) {
      var vs = Array.isArray(episode.servers) ? episode.servers.filter(function (s) { return s && s.url && isValidUrl(s.url); }) : [];
      D.serversGrid.innerHTML = vs.length ? vs.map(function (s) { return createServiceBtn(s, 'server'); }).join('') : '<div style="grid-column:1/-1;text-align:center;padding:20px;color:var(--text-muted)">لا توجد خوادم متاحة</div>';
      if (D.playerPlaceholder) D.playerPlaceholder.classList.remove('hidden');
      if (D.videoPlayer)       { D.videoPlayer.src = ''; D.videoPlayer.style.opacity = '0'; D.videoPlayer.style.pointerEvents = 'none'; }
    }

    /* downloads */
    resetServiceColors();
    if (D.downloadsGrid) {
      var vd = Array.isArray(episode.downloads) ? episode.downloads.filter(function (d) { return d && d.url && isValidUrl(d.url); }) : [];
      D.downloadsGrid.innerHTML = vd.length ? vd.map(function (d) { return createServiceBtn(d, 'download'); }).join('') : '<div style="grid-column:1/-1;text-align:center;padding:20px;color:var(--text-muted)">لا توجد روابط تحميل</div>';
    }

    D.playerSection.setAttribute('data-loaded', 'true');
  }

  /* =========================================================
     12. RENDER SEASONS
  ========================================================= */
  function buildSeasonContent(seasons, allEpisodes) {
    var map = new Map();
    seasons.forEach(function (s) { var n = parseInt(s.seasonNumber) || 1; if (!map.has(n)) map.set(n, s); });
    var cur = map.get(State.currentSeason);
    if (!cur) return { infoHTML: '', episodesHTML: '' };

    var sStart = cur.startEpisode || 1, sEnd = cur.endEpisode || null, eCount = cur.episodeCount || null;
    var infoHTML = buildSeasonInfoHTML(State.currentSeason, sStart, sEnd, eCount);

    var avail = [];
    if (Array.isArray(allEpisodes)) {
      allEpisodes.forEach(function (ep) {
        if ((parseInt(ep.seasonNumber) || 1) !== State.currentSeason) return;
        var num = normalizeEpisode(ep.episodeNumber);
        var hasLink = ep.pageLink && ep.pageLink.toString().trim() !== '' && ep.pageLink.toString().trim().toLowerCase() !== 'null';
        if (hasLink) avail.push({ num: num, link: ep.pageLink.toString().trim(), isCurrent: num === CONFIG.EPISODE_NUM_NORMALIZED });
      });
    }
    avail.sort(function (a, b) { return parseInt(a.num) - parseInt(b.num); });

    var dispEnd = sEnd ? parseInt(sEnd) : (avail.length ? parseInt(avail[avail.length - 1].num) : parseInt(sStart) + 11);
    var epHTML = '';
    for (var n = parseInt(sStart); n <= dispEnd; n++) {
      var pad = n.toString().padStart(2, '0');
      var norm = normalizeEpisode(pad);
      var found = null;
      for (var i = 0; i < avail.length; i++) { if (avail[i].num === norm) { found = avail[i]; break; } }
      if (found) {
        if (found.isCurrent) epHTML += '<span class="episode-card-new active" style="overflow:visible;">' + pad + '<span class="episode-watching-badge">جاري</span></span>';
        else epHTML += '<a href="' + found.link + '" class="episode-card-new">' + pad + '</a>';
      } else {
        epHTML += '<button class="episode-card-new disabled" disabled>' + pad + '</button>';
      }
    }
    return { infoHTML: infoHTML, episodesHTML: epHTML };
  }

  function renderNewSeasons(seasons, allEpisodes, animated) {
    if (!D.newSeasonsSelector || !D.seasonContentWrapper) return;
    if (!Array.isArray(seasons) || !seasons.length) {
      D.newSeasonsSelector.innerHTML = '<span style="color:var(--text-muted);padding:8px">لا توجد مواسم</span>';
      D.seasonContentWrapper.innerHTML = '';
      if (D.seasonsSection) D.seasonsSection.setAttribute('data-loaded', 'true'); return;
    }

    var map = new Map();
    seasons.forEach(function (s) { var n = parseInt(s.seasonNumber) || 1; if (!map.has(n)) map.set(n, s); });
    var unique = Array.from(map.values()).sort(function (a, b) { return (parseInt(a.seasonNumber) || 1) - (parseInt(b.seasonNumber) || 1); });

    D.newSeasonsSelector.innerHTML = unique.map(function (s) {
      var n = parseInt(s.seasonNumber) || 1;
      return '<button class="season-select-btn ' + (n === State.currentSeason ? 'active' : '') + '" data-season="' + n + '" onclick="__WatchApp.switchSeason(' + n + ')">الموسم ' + fmt2(n) + '</button>';
    }).join('');

    var content = buildSeasonContent(seasons, allEpisodes);
    function inject() {
      var div = document.createElement('div');
      div.className = 'season-content-new'; div.id = 'seasonContentNew';
      div.innerHTML = '<div class="season-header-card"><span class="season-info-text" id="seasonInfoText">' + content.infoHTML + '</span></div>'
        + '<div class="episodes-grid-new" id="newEpisodesGrid" style="overflow:visible;">' + content.episodesHTML + '</div>';
      D.seasonContentWrapper.innerHTML = '';
      D.seasonContentWrapper.appendChild(div);
      D.seasonContentNew = div;
      D.newEpisodesGrid  = document.getElementById('newEpisodesGrid');
      D.seasonInfoText   = document.getElementById('seasonInfoText');
    }

    if (!animated) { inject(); if (D.seasonsSection) D.seasonsSection.setAttribute('data-loaded', 'true'); return; }
    State.seasonSwitching = true;
    var old = D.seasonContentWrapper.querySelector('.season-content-new');
    if (old) { old.classList.add('exiting'); setTimeout(function () { inject(); State.seasonSwitching = false; }, 190); }
    else { inject(); State.seasonSwitching = false; }
    if (D.seasonsSection) D.seasonsSection.setAttribute('data-loaded', 'true');
  }

  /* =========================================================
     13. RENDER NAVIGATION
  ========================================================= */
  function renderNavigation(nav) {
    function setup(prev, next) {
      if (!prev || !next) return;
      if (!nav || nav.error) { prev.disabled = true; next.disabled = true; return; }
      prev.disabled = !(nav.previous && nav.previous.trim());
      next.disabled = !(nav.next     && nav.next.trim());
      if (!prev.disabled) prev.onclick = function (e) { e.preventDefault(); window.location.href = nav.previous; };
      if (!next.disabled) next.onclick = function (e) { e.preventDefault(); window.location.href = nav.next; };
    }
    setup(D.prevEpisode, D.nextEpisode);
    setup(D.prevEpisodeBottom, D.nextEpisodeBottom);
  }

  /* =========================================================
     14. READ MORE
  ========================================================= */
  function initReadMore() {
    var desc = D.animeDescription, btn = D.readMoreBtn;
    if (!desc || !btn) return;
    if (!isNonDesktop()) { btn.classList.remove('show-mobile'); desc.classList.remove('expanded'); return; }
    desc.style.cssText = 'display:block;-webkit-line-clamp:unset;overflow:visible';
    var full = desc.scrollHeight;
    desc.style.cssText = '';
    var clamped = desc.scrollHeight;
    if (full > clamped + 5) btn.classList.add('show-mobile'); else { btn.classList.remove('show-mobile'); return; }
    if (btn._init) return; btn._init = true;
    btn.addEventListener('click', function () {
      var exp = desc.classList.contains('expanded');
      desc.classList.toggle('expanded', !exp);
      btn.classList.toggle('expanded', !exp);
      if (D.readMoreText) D.readMoreText.textContent = exp ? 'قراءة المزيد' : 'عرض أقل';
    });
  }

  /* =========================================================
     15. PUBLIC APP ACTIONS
  ========================================================= */
  var WatchApp = {
    selectServer: function (btn) {
      if (!btn || !D.videoPlayer) return;
      var url = btn.getAttribute('data-url');
      if (!url || !isValidUrl(url)) return;
      document.querySelectorAll('.server-btn').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      if (D.playerPlaceholder) D.playerPlaceholder.classList.add('hidden');
      D.videoPlayer.style.opacity = '0.4'; D.videoPlayer.style.pointerEvents = 'none';
      D.videoPlayer.src = ''; D.videoPlayer.src = url;
      var reset = function () { D.videoPlayer.style.opacity = '1'; D.videoPlayer.style.pointerEvents = 'auto'; };
      D.videoPlayer.onload = reset; D.videoPlayer.onerror = reset;
      setTimeout(reset, 3000);
      setTimeout(function () { scrollToEl(D.playerContainer); }, 80);
    },

    switchSeason: function (num) {
      if (State.currentSeason === num || State.seasonSwitching) return;
      State.currentSeason = num;
      document.querySelectorAll('.season-select-btn').forEach(function (b) {
        b.classList.toggle('active', parseInt(b.getAttribute('data-season')) === num);
      });
      if (State.data.seasons && State.data.seasons.length) renderNewSeasons(State.data.seasons, State.data.allEpisodes, true);
    },

    toggleWatchMode: function () {
      State.watchMode = !State.watchMode;
      document.body.classList.toggle('watch-mode-active', State.watchMode);
      var icon = State.watchMode ? 'expand-alt' : 'compress-alt';
      var text = State.watchMode ? 'إلغاء الوضع' : 'وضع المشاهدة';
      if (D.watchModeText) D.watchModeText.textContent = text;
      document.querySelectorAll('.watch-mode-btn').forEach(function (b) {
        var i = b.querySelector('i'); if (i) i.className = 'fas fa-' + icon;
      });
      if (D.watchModeFloating) { var fi = D.watchModeFloating.querySelector('.wm-icon'); if (fi) fi.className = 'fas fa-' + icon + ' wm-icon'; }
    },

    showError: function (msg) {
      if (!D.mainContent) return;
      D.mainContent.innerHTML = '<div class="unified-card error-placeholder" style="margin:20px"><i class="fas fa-exclamation-triangle"></i><h3 style="margin:8px 0">حدث خطأ</h3><p style="color:var(--text-tertiary);margin-bottom:16px">' + safeText(msg) + '</p><button class="btn btn-primary" onclick="__WatchApp.loadData()"><i class="fas fa-redo"></i> إعادة المحاولة</button></div>';
    },

    loadData: function () {
      if (State.isLoading) return;
      State.isLoading = true; State.posterLoaded = false; State.dataLoaded = false;
      ['animeInfoLoading','playerSectionLoading','seasonsSectionLoading'].forEach(function (id) { if (D[id]) D[id].classList.add('active'); });

      Promise.all([fetchMain(CONFIG.ANIME_NAME, CONFIG.EPISODE_NUM, CONFIG.EPISODE_NUM_NORMALIZED), fetchNav(CONFIG.ANIME_NAME, CONFIG.EPISODE_NUM)])
        .then(function (res) {
          var main = res[0], nav = res[1];
          if (main && main.error) throw new Error(main.message || 'خطأ في جلب البيانات');
          var allEps = (main.allEpisodes && main.allEpisodes.episodes) ? main.allEpisodes.episodes : (Array.isArray(main.allEpisodes) ? main.allEpisodes : []);
          State.data = { anime: main.anime, episode: main.episode, seasons: main.seasons, notifications: main.notifications, navigation: nav, allEpisodes: allEps };
          renderNotifications(main.notifications);
          renderAnimeInfo(main.anime);
          renderEpisodeInfo(main.episode);
          renderNewSeasons(main.seasons, allEps, false);
          renderNavigation(nav);
          State.dataLoaded = true; checkAllLoaded();
          document.querySelectorAll('.unified-card').forEach(function (c) { c.setAttribute('data-loaded', 'true'); });
        })
        .catch(function (e) {
          ['animeInfoLoading','playerSectionLoading','seasonsSectionLoading'].forEach(function (id) { if (D[id]) D[id].classList.remove('active'); });
          WatchApp.showError(e.message || 'تعذر جلب البيانات');
        })
        .finally(function () { State.isLoading = false; });
    }
  };

  window.__WatchApp = WatchApp;

  /* =========================================================
     16. INIT
  ========================================================= */
  function initConfig() {
    var uc = window.USER_CONFIG || {};
    CONFIG.ANIME_NAME     = uc.ANIME_NAME     ? decodeURIComponent(uc.ANIME_NAME.trim())     : '';
    CONFIG.EPISODE_NUM    = uc.EPISODE_NUM    ? uc.EPISODE_NUM.trim()                        : '';
    CONFIG.PAGE_TYPE      = uc.PAGE_TYPE      ? uc.PAGE_TYPE.trim().toLowerCase()            : 'free';
    CONFIG.IS_MOVIE       = !!uc.IS_MOVIE;
    CONFIG.MAIN_API_URL   = uc.MAIN_API_URL   ? uc.MAIN_API_URL.trim()                       : '';
    CONFIG.NAV_API_URL    = uc.NAV_API_URL    ? uc.NAV_API_URL.trim()                        : '';
    CONFIG.UPGRADE_URL    = uc.UPGRADE_URL    ? uc.UPGRADE_URL.trim()                        : '';
    CONFIG.POSTER_URL     = uc.POSTER_URL     ? uc.POSTER_URL.trim()                         : '';
    CONFIG.PRIVACY_URL    = uc.PRIVACY_URL    ? uc.PRIVACY_URL.trim()                        : '';
    CONFIG.DISCLAIMER_URL = uc.DISCLAIMER_URL ? uc.DISCLAIMER_URL.trim()                     : '';
    CONFIG.TERMS_URL      = uc.TERMS_URL      ? uc.TERMS_URL.trim()                          : '';
    CONFIG.CONTACT_URL    = uc.CONTACT_URL    ? uc.CONTACT_URL.trim()                        : '';
    CONFIG.REPORT_URL     = uc.REPORT_URL     ? uc.REPORT_URL.trim()                         : '';
    CONFIG.PAGE_TITLE     = uc.PAGE_TITLE     ? uc.PAGE_TITLE.trim()                         : '';
    if (CONFIG.PAGE_TITLE) document.title = CONFIG.PAGE_TITLE;
    CONFIG.EPISODE_NUM_NORMALIZED = normalizeEpisode(CONFIG.EPISODE_NUM);
    return !!(CONFIG.ANIME_NAME && CONFIG.EPISODE_NUM && CONFIG.MAIN_API_URL);
  }

  function initLinks() {
    if (D.upgradeFloating)  D.upgradeFloating.href  = CONFIG.UPGRADE_URL    || '#';
    if (D.privacyLink)      D.privacyLink.href       = normalizeUrl(CONFIG.PRIVACY_URL    || '');
    if (D.dmcaLink)         D.dmcaLink.href          = normalizeUrl(CONFIG.DISCLAIMER_URL || '');
    if (D.termsLink)        D.termsLink.href         = normalizeUrl(CONFIG.TERMS_URL      || '');
    if (D.contactLink)      D.contactLink.href       = normalizeUrl(CONFIG.CONTACT_URL    || '');
    if (D.reportBtn)        D.reportBtn.href         = normalizeUrl(CONFIG.REPORT_URL     || '');
  }
  function handleFullscreen() {
    var iframe = D.videoPlayer;
    var container = D.playerContainer;
    if (!iframe || !container) return;

    function onFullscreenChange() {
      var isFS = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      );
      if (isFS) {
        iframe.style.cssText = 'position:fixed!important;top:0!important;left:0!important;width:100vw!important;height:100vh!important;z-index:99999!important;background:#000!important;border-radius:0!important;opacity:1!important;pointer-events:auto!important;';
        container.style.cssText = 'position:fixed!important;top:0!important;left:0!important;width:100vw!important;height:100vh!important;z-index:99998!important;padding:0!important;background:#000!important;border-radius:0!important;';
      } else {
        iframe.style.cssText = 'opacity:1;pointer-events:auto;';
        container.style.cssText = '';
      }
    }

    document.addEventListener('fullscreenchange',       onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);
    document.addEventListener('mozfullscreenchange',    onFullscreenChange);
    document.addEventListener('MSFullscreenChange',     onFullscreenChange);

    window.addEventListener('message', function(e) {
      if (!e.data) return;
      var d = typeof e.data === 'string' ? e.data : JSON.stringify(e.data);
      if (d.indexOf('fullscreen') !== -1 || d.indexOf('requestFullscreen') !== -1) {
        if (container.requestFullscreen)            container.requestFullscreen();
        else if (container.webkitRequestFullscreen) container.webkitRequestFullscreen();
        else if (container.mozRequestFullScreen)    container.mozRequestFullScreen();
        else if (container.msRequestFullscreen)     container.msRequestFullscreen();
      }
    });
  }
  function initEvents() {
    [D.watchModeToggle, D.watchModeFloating].forEach(function (b) { if (b) b.addEventListener('click', WatchApp.toggleWatchMode); });
    if (D.playerPlaceholder) D.playerPlaceholder.addEventListener('click', function () { scrollToEl(D.serversSection); });
    var lastY = 0, ticking = false;
    window.addEventListener('scroll', function () {
      if (!ticking) { requestAnimationFrame(function () { var y = window.scrollY; if (D.mainHeader) D.mainHeader.classList.toggle('scrolled', y > 100 && y > lastY); lastY = y; ticking = false; }); ticking = true; }
    }, { passive: true });
    document.addEventListener('keydown', function (e) {
      if (['INPUT','TEXTAREA','SELECT'].indexOf(e.target.tagName) !== -1) return;
      if (e.key === 'ArrowRight' && D.prevEpisode && !D.prevEpisode.disabled) { e.preventDefault(); D.prevEpisode.click(); }
      if (e.key === 'ArrowLeft'  && D.nextEpisode && !D.nextEpisode.disabled) { e.preventDefault(); D.nextEpisode.click(); }
     if (e.key === 'w' || e.key === 'W') { e.preventDefault(); WatchApp.toggleWatchMode(); }
      if ((e.key === 'f' || e.key === 'F') && D.playerContainer && State.playerActive) {
        e.preventDefault();
        var c = D.playerContainer;
        if (c.requestFullscreen)            c.requestFullscreen();
        else if (c.webkitRequestFullscreen) c.webkitRequestFullscreen();
        else if (c.mozRequestFullScreen)    c.mozRequestFullScreen();
        else if (c.msRequestFullscreen)     c.msRequestFullscreen();
      }
    });
    var rt;
    window.addEventListener('resize', function () {
      clearTimeout(rt); rt = setTimeout(function () { if (D.animeDescription && D.animeDescription.textContent.trim()) initReadMore(); }, 300);
    }, { passive: true });
  }

  function init() {
    buildHTML();
    cacheDOM();
    var ok = initConfig();
    initLinks();
    initEvents();
   handleFullscreen();
    if (ok) WatchApp.loadData();
    else if (D.mainContent) D.mainContent.innerHTML = '<div class="unified-card error-placeholder" style="margin:20px"><i class="fas fa-cog"></i><h3 style="margin:8px 0">إعداد غير مكتمل</h3><p style="color:var(--text-tertiary)">يرجى ملء USER_CONFIG: ANIME_NAME و EPISODE_NUM و MAIN_API_URL</p></div>';
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
console.log('watch.js executing - end');
