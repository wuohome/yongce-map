// bug-report.js — 問題回報 widget（共用，任何頁面加 <script src="bug-report.js"></script> 即可）
// Worker endpoint — 日後改位置只動這一行
const BUG_REPORT_ENDPOINT = 'https://wuohome-ragic-proxy.wuohome.workers.dev/reportBug';

(function () {
  'use strict';

  // 回報裡不能帶同仁的專屬通行碼（?token=…），只保留其他參數
  function safeSearch() {
    try {
      var q = new URLSearchParams(location.search);
      ['token', 't', 'key'].forEach(function (k) { if (q.has(k)) q.set(k, '***'); });
      var s = q.toString();
      return s ? '?' + s : '';
    } catch (e) { return ''; } // ponytail-debt: 網址解析失敗就不附參數，寧可少資訊也不外洩通行碼
  }

  // ── 防重複掛載 ──
  if (document.getElementById('wh-bug-report-btn')) return;

  // ── 全域 style ──
  var style = document.createElement('style');
  style.textContent = [
    '#wh-bug-report-btn{',
      'position:fixed;right:20px;bottom:24px;z-index:99990;',
      'width:48px;height:48px;border-radius:50%;',
      'background:#ff6b35;color:#fff;border:none;cursor:pointer;',
      'box-shadow:0 4px 14px rgba(255,107,53,.45);',
      'display:flex;align-items:center;justify-content:center;',
      'font-size:20px;transition:transform .15s,box-shadow .15s;',
      'outline:none;',
    '}',
    '#wh-bug-report-btn:hover{transform:scale(1.1);box-shadow:0 6px 20px rgba(255,107,53,.55);}',
    '#wh-bug-report-btn:active{transform:scale(.97);}',
    '#wh-bug-report-btn title{display:none;}',

    // Tooltip
    '#wh-bug-report-btn::after{',
      'content:"問題回報";',
      'position:absolute;right:56px;top:50%;transform:translateY(-50%);',
      'background:rgba(30,30,30,.88);color:#fff;font-size:12px;',
      'padding:4px 10px;border-radius:6px;white-space:nowrap;',
      'pointer-events:none;opacity:0;transition:opacity .15s;font-family:sans-serif;',
    '}',
    '#wh-bug-report-btn:hover::after{opacity:1;}',

    // Backdrop
    '#wh-bug-backdrop{',
      'display:none;position:fixed;inset:0;z-index:99991;',
      'background:rgba(0,0,0,.45);backdrop-filter:blur(2px);',
    '}',
    '#wh-bug-backdrop.wh-open{display:block;}',

    // Modal
    '#wh-bug-modal{',
      'display:none;position:fixed;z-index:99992;',
      'top:50%;left:50%;transform:translate(-50%,-48%) scale(.97);',
      'background:#fff;border-radius:16px;',
      'box-shadow:0 20px 60px rgba(0,0,0,.18);',
      'width:min(520px, calc(100vw - 32px));max-height:calc(100vh - 48px);',
      'overflow-y:auto;transition:transform .2s, opacity .2s;opacity:0;',
      'font-family:"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif;',
    '}',
    '#wh-bug-modal.wh-open{',
      'display:block;transform:translate(-50%,-50%) scale(1);opacity:1;',
    '}',

    '.wh-modal-header{',
      'padding:20px 24px 12px;border-bottom:1px solid #f0f0f0;',
    '}',
    '.wh-modal-title{font-size:17px;font-weight:700;color:#1a1a1a;margin:0 0 2px;}',
    '.wh-modal-sub{font-size:13px;color:#666;margin:0;}',

    '.wh-modal-body{padding:16px 24px 20px;}',

    '.wh-section{margin-bottom:14px;}',
    '.wh-label{font-size:13px;font-weight:600;color:#444;margin-bottom:6px;display:block;}',
    '.wh-required{color:#e05a2b;}',

    // Screenshot preview
    '#wh-screenshot-wrap{',
      'border:2px dashed #d9e2f0;border-radius:10px;',
      'min-height:80px;display:flex;align-items:center;justify-content:center;',
      'overflow:hidden;position:relative;background:#f8faff;',
    '}',
    '#wh-screenshot-img{max-width:100%;max-height:160px;object-fit:contain;display:none;}',
    '#wh-screenshot-placeholder{color:#aab4c8;font-size:13px;text-align:center;padding:16px;}',
    '#wh-screenshot-actions{',
      'position:absolute;top:6px;right:6px;display:flex;gap:6px;',
    '}',
    '.wh-ss-btn{',
      'font-size:11px;padding:3px 8px;border-radius:6px;border:none;cursor:pointer;',
      'background:rgba(255,255,255,.9);color:#444;box-shadow:0 1px 4px rgba(0,0,0,.15);',
      'transition:background .12s;',
    '}',
    '.wh-ss-btn:hover{background:#fff;}',

    // Upload
    '#wh-upload-area{',
      'border:2px dashed #d9e2f0;border-radius:10px;padding:12px 16px;',
      'cursor:pointer;text-align:center;background:#f8faff;',
      'transition:border-color .15s;',
    '}',
    '#wh-upload-area:hover{border-color:#6aabf7;}',
    '#wh-upload-input{display:none;}',
    '#wh-upload-count{font-size:12px;color:#888;margin-top:4px;}',
    '#wh-upload-thumbs{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;}',
    '.wh-thumb{',
      'width:56px;height:56px;border-radius:6px;object-fit:cover;',
      'border:1px solid #e0e0e0;',
    '}',

    // Path field
    '#wh-page-path{',
      'width:100%;box-sizing:border-box;',
      'padding:8px 10px;border:1px solid #d9e2f0;border-radius:8px;',
      'background:#f5f5f5;color:#888;font-size:12px;font-family:monospace;',
      'cursor:default;outline:none;',
    '}',

    // Select
    '#wh-bug-type{',
      'width:100%;box-sizing:border-box;',
      'padding:8px 10px;border:1px solid #d9e2f0;border-radius:8px;',
      'background:#fff;font-size:14px;color:#222;outline:none;cursor:pointer;',
      'appearance:none;-webkit-appearance:none;',
      'background-image:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'8\'%3E%3Cpath d=\'M0 0l6 8 6-8\' fill=\'%23888\'/%3E%3C/svg%3E");',
      'background-repeat:no-repeat;background-position:right 12px center;',
    '}',
    '#wh-bug-type:focus{border-color:#6aabf7;}',

    // Textarea
    '#wh-bug-desc{',
      'width:100%;box-sizing:border-box;',
      'padding:10px 12px;border:1px solid #d9e2f0;border-radius:8px;',
      'font-size:14px;color:#222;resize:vertical;min-height:90px;outline:none;',
      'font-family:"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif;',
      'transition:border-color .15s;',
    '}',
    '#wh-bug-desc:focus{border-color:#6aabf7;}',
    '#wh-desc-err{font-size:12px;color:#e05a2b;margin-top:4px;display:none;}',

    // Footer
    '.wh-modal-footer{',
      'padding:0 24px 20px;display:flex;justify-content:flex-end;gap:10px;',
    '}',
    '.wh-btn-cancel{',
      'padding:9px 20px;border-radius:8px;border:1px solid #d9e2f0;',
      'background:#fff;color:#555;font-size:14px;cursor:pointer;',
      'transition:background .12s;font-weight:500;',
    '}',
    '.wh-btn-cancel:hover{background:#f5f7fa;}',
    '.wh-btn-submit{',
      'padding:9px 22px;border-radius:8px;border:none;',
      'background:#ff6b35;color:#fff;font-size:14px;cursor:pointer;',
      'font-weight:600;transition:background .12s, opacity .15s;',
    '}',
    '.wh-btn-submit:hover{background:#e85c28;}',
    '.wh-btn-submit:disabled{opacity:.6;cursor:default;}',

    // Toast
    '#wh-toast{',
      'position:fixed;bottom:32px;left:50%;transform:translateX(-50%) translateY(20px);',
      'z-index:99999;background:#222;color:#fff;font-size:14px;',
      'padding:10px 20px;border-radius:10px;',
      'opacity:0;transition:opacity .3s, transform .3s;pointer-events:none;white-space:nowrap;',
    '}',
    '#wh-toast.wh-show{opacity:1;transform:translateX(-50%) translateY(0);}',

    // Loading spinner in button
    '.wh-spinner{',
      'display:inline-block;width:14px;height:14px;',
      'border:2px solid rgba(255,255,255,.4);border-top-color:#fff;',
      'border-radius:50%;animation:wh-spin .7s linear infinite;vertical-align:middle;margin-right:6px;',
    '}',
    '@keyframes wh-spin{to{transform:rotate(360deg)}}',

    // RWD
    '@media(max-width:540px){',
      '#wh-bug-modal{width:calc(100vw - 24px);}',
      '.wh-modal-body{padding:12px 16px 16px;}',
      '.wh-modal-footer{padding:0 16px 16px;}',
    '}',
  ].join('');
  document.head.appendChild(style);

  // ── HTML ──
  var backdrop = document.createElement('div');
  backdrop.id = 'wh-bug-backdrop';
  document.body.appendChild(backdrop);

  var modal = document.createElement('div');
  modal.id = 'wh-bug-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', '問題回報');
  modal.innerHTML = [
    '<div class="wh-modal-header">',
      '<p class="wh-modal-title">🐛 問題回報</p>',
      '<p class="wh-modal-sub">已截取頁面畫面，請描述您遇到的問題。</p>',
    '</div>',
    '<div class="wh-modal-body">',

      // Screenshot
      '<div class="wh-section">',
        '<span class="wh-label">📷 自動截圖</span>',
        '<div id="wh-screenshot-wrap">',
          '<div id="wh-screenshot-placeholder">截圖擷取中…</div>',
          '<img id="wh-screenshot-img" alt="截圖預覽">',
          '<div id="wh-screenshot-actions" style="display:none">',
            '<button class="wh-ss-btn" id="wh-retake-btn">重新截圖 🔄</button>',
            '<button class="wh-ss-btn" id="wh-remove-ss-btn">移除 ✕</button>',
          '</div>',
        '</div>',
      '</div>',

      // Upload
      '<div class="wh-section">',
        '<span class="wh-label" id="wh-upload-label">🖼️ 上傳圖片 (<span id="wh-upload-cnt">0</span>/5)</span>',
        '<div id="wh-upload-area" tabindex="0" role="button" aria-label="點擊上傳圖片">',
          '<span style="font-size:13px;color:#888">點擊上傳（每張最大 5MB，最多 5 張）</span>',
        '</div>',
        '<input type="file" id="wh-upload-input" accept="image/*" multiple>',
        '<div id="wh-upload-thumbs"></div>',
      '</div>',

      // Path
      '<div class="wh-section">',
        '<span class="wh-label">📍 頁面位置</span>',
        '<input id="wh-page-path" type="text" readonly tabindex="-1">',
      '</div>',

      // Type
      '<div class="wh-section">',
        '<span class="wh-label">問題類型</span>',
        '<select id="wh-bug-type">',
          '<option value="功能異常">🐛 功能異常</option>',
          '<option value="版面問題">🖼️ 版面問題</option>',
          '<option value="資料錯誤">📊 資料錯誤</option>',
          '<option value="建議">💡 建議</option>',
          '<option value="其他">📝 其他</option>',
        '</select>',
      '</div>',

      // Description
      '<div class="wh-section">',
        '<span class="wh-label">問題描述 <span class="wh-required">*</span></span>',
        '<textarea id="wh-bug-desc" placeholder="請描述您遇到的問題，例如：點擊某個按鈕後沒有反應、頁面顯示異常…" maxlength="1000"></textarea>',
        '<div id="wh-desc-err">請填寫問題描述（至少 3 個字）</div>',
      '</div>',

    '</div>',// end body
    '<div class="wh-modal-footer">',
      '<button class="wh-btn-cancel" id="wh-cancel-btn">取消</button>',
      '<button class="wh-btn-submit" id="wh-submit-btn">送出回報</button>',
    '</div>',
  ].join('');
  document.body.appendChild(modal);

  var toast = document.createElement('div');
  toast.id = 'wh-toast';
  document.body.appendChild(toast);

  // Trigger button
  var btn = document.createElement('button');
  btn.id = 'wh-bug-report-btn';
  btn.title = '問題回報';
  btn.setAttribute('aria-label', '問題回報');
  btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M11 15h2v2h-2v-2zm0-8h2v6h-2V7zm1-5C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>';
  document.body.appendChild(btn);

  // ── State ──
  var screenshotDataUrl = null;
  var uploadFiles = []; // array of dataURL strings
  var html2canvasLoaded = false;
  var isSubmitting = false;

  // ── Helpers ──
  function showToast(msg, duration) {
    toast.textContent = msg;
    toast.classList.add('wh-show');
    setTimeout(function () { toast.classList.remove('wh-show'); }, duration || 3000);
  }

  function setScreenshot(dataUrl) {
    screenshotDataUrl = dataUrl;
    var img = document.getElementById('wh-screenshot-img');
    var placeholder = document.getElementById('wh-screenshot-placeholder');
    var actions = document.getElementById('wh-screenshot-actions');
    if (dataUrl) {
      img.src = dataUrl;
      img.style.display = 'block';
      placeholder.style.display = 'none';
      actions.style.display = 'flex';
    } else {
      img.src = '';
      img.style.display = 'none';
      placeholder.style.display = 'block';
      placeholder.textContent = '截圖已移除（仍可送出純文字回報）';
      actions.style.display = 'none';
    }
  }

  function updateUploadCount() {
    document.getElementById('wh-upload-cnt').textContent = uploadFiles.length;
  }

  function renderThumbs() {
    var wrap = document.getElementById('wh-upload-thumbs');
    wrap.innerHTML = '';
    uploadFiles.forEach(function (dataUrl, i) {
      var img = document.createElement('img');
      img.className = 'wh-thumb';
      img.src = dataUrl;
      img.alt = '附圖 ' + (i + 1);
      img.style.cursor = 'pointer';
      img.title = '點擊移除';
      img.addEventListener('click', function () {
        uploadFiles.splice(i, 1);
        updateUploadCount();
        renderThumbs();
      });
      wrap.appendChild(img);
    });
  }

  // Compress image to JPEG, max longEdge px, quality 0-1
  function compressImage(dataUrl, maxLongEdge, quality, cb) {
    var img = new Image();
    img.onload = function () {
      var w = img.naturalWidth, h = img.naturalHeight;
      if (Math.max(w, h) > maxLongEdge) {
        var ratio = maxLongEdge / Math.max(w, h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }
      var canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      cb(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = function () { cb(dataUrl); }; // fallback: use original
    img.src = dataUrl;
  }

  // Lazy-load html2canvas
  function loadHtml2canvas(cb) {
    if (html2canvasLoaded && window.html2canvas) { cb(); return; }
    var s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
    s.onload = function () { html2canvasLoaded = true; cb(); };
    s.onerror = function () { cb(new Error('html2canvas load failed')); };
    document.head.appendChild(s);
  }

  function takeScreenshot(cb) {
    loadHtml2canvas(function (err) {
      if (err) { cb(null); return; } // graceful: no screenshot
      // ponytail-debt: html2canvas 對跨域圖片預設失敗，useCORS:true 嘗試但不保證；
      // 若頁面有跨域圖片截圖會有空白區塊，可接受（仍傳其他部分）。
      window.html2canvas(document.body, {
        useCORS: true,
        allowTaint: false,
        logging: false,
        scale: Math.min(window.devicePixelRatio || 1, 2),
        // 忽略高 z-index 的 bug report UI（截圖時 modal 未開，按鈕本身 z-index 較高但 small）
        ignoreElements: function (el) {
          return el.id === 'wh-bug-report-btn';
        },
      }).then(function (canvas) {
        compressImage(canvas.toDataURL('image/jpeg', 1), 1600, 0.8, function (compressed) {
          cb(compressed);
        });
      }).catch(function () { cb(null); });
    });
  }

  // ── Open / Close ──
  function openModal() {
    backdrop.classList.add('wh-open');
    // Small rAF to trigger CSS transition
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        modal.classList.add('wh-open');
      });
    });
    document.getElementById('wh-page-path').value = location.pathname + safeSearch();
    document.getElementById('wh-bug-desc').value = '';
    document.getElementById('wh-desc-err').style.display = 'none';
    document.getElementById('wh-bug-type').value = '功能異常';
    uploadFiles = [];
    updateUploadCount();
    renderThumbs();
    document.getElementById('wh-screenshot-placeholder').textContent = '截圖擷取中…';
    setScreenshot(null);
    document.getElementById('wh-screenshot-actions').style.display = 'none';
    document.getElementById('wh-screenshot-img').style.display = 'none';
    document.getElementById('wh-screenshot-placeholder').style.display = 'block';
  }

  function closeModal() {
    modal.classList.remove('wh-open');
    backdrop.classList.remove('wh-open');
  }

  // ── Events ──
  btn.addEventListener('click', function () {
    // 1. Capture first, then open modal
    btn.style.pointerEvents = 'none';
    takeScreenshot(function (dataUrl) {
      btn.style.pointerEvents = '';
      openModal();
      if (dataUrl) {
        setScreenshot(dataUrl);
      } else {
        document.getElementById('wh-screenshot-placeholder').textContent = '截圖失敗（仍可送出純文字回報）';
      }
    });
  });

  document.getElementById('wh-cancel-btn').addEventListener('click', closeModal);
  backdrop.addEventListener('click', closeModal);

  document.getElementById('wh-retake-btn').addEventListener('click', function () {
    document.getElementById('wh-screenshot-placeholder').textContent = '重新截圖中…';
    setScreenshot(null);
    document.getElementById('wh-screenshot-placeholder').style.display = 'block';
    takeScreenshot(function (dataUrl) {
      if (dataUrl) setScreenshot(dataUrl);
      else document.getElementById('wh-screenshot-placeholder').textContent = '截圖失敗';
    });
  });

  document.getElementById('wh-remove-ss-btn').addEventListener('click', function () {
    setScreenshot(null);
  });

  // Upload
  var uploadArea = document.getElementById('wh-upload-area');
  var uploadInput = document.getElementById('wh-upload-input');

  function handleFiles(files) {
    Array.from(files).forEach(function (file) {
      if (uploadFiles.length >= 5) return;
      if (!file.type.startsWith('image/')) return;
      if (file.size > 5 * 1024 * 1024) { showToast('圖片超過 5MB 限制'); return; }
      var reader = new FileReader();
      reader.onload = function (e) {
        compressImage(e.target.result, 1600, 0.8, function (compressed) {
          if (uploadFiles.length < 5) {
            uploadFiles.push(compressed);
            updateUploadCount();
            renderThumbs();
          }
        });
      };
      reader.readAsDataURL(file);
    });
  }

  uploadArea.addEventListener('click', function () { uploadInput.click(); });
  uploadArea.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') uploadInput.click(); });
  uploadInput.addEventListener('change', function () { handleFiles(this.files); this.value = ''; });

  // Drag & drop on upload area
  uploadArea.addEventListener('dragover', function (e) { e.preventDefault(); uploadArea.style.borderColor = '#6aabf7'; });
  uploadArea.addEventListener('dragleave', function () { uploadArea.style.borderColor = ''; });
  uploadArea.addEventListener('drop', function (e) {
    e.preventDefault();
    uploadArea.style.borderColor = '';
    if (e.dataTransfer && e.dataTransfer.files) handleFiles(e.dataTransfer.files);
  });

  // Submit
  document.getElementById('wh-submit-btn').addEventListener('click', function () {
    if (isSubmitting) return;
    var desc = document.getElementById('wh-bug-desc').value.trim();
    if (desc.length < 3) {
      document.getElementById('wh-desc-err').style.display = 'block';
      document.getElementById('wh-bug-desc').focus();
      return;
    }
    document.getElementById('wh-desc-err').style.display = 'none';
    isSubmitting = true;

    var submitBtn = document.getElementById('wh-submit-btn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="wh-spinner"></span>送出中…';

    var payload = {
      description: desc,
      type: document.getElementById('wh-bug-type').value,
      url: location.origin + location.pathname + safeSearch() + location.hash.replace(/token=[^&]*/gi, 'token=***'),
      title: document.title,
      userAgent: navigator.userAgent,
      screenshot: screenshotDataUrl || '',
      uploads: uploadFiles.slice(0, 5),
    };

    fetch(BUG_REPORT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(function (res) { return res.json(); })
      .then(function (json) {
        isSubmitting = false;
        submitBtn.disabled = false;
        submitBtn.textContent = '送出回報';
        if (json.ok) {
          closeModal();
          showToast('已送出，謝謝回報 🎉', 3500);
        } else {
          showToast('送出失敗：' + (json.error || '未知錯誤') + '，請再試一次', 4000);
        }
      })
      .catch(function (err) {
        isSubmitting = false;
        submitBtn.disabled = false;
        submitBtn.textContent = '送出回報';
        showToast('網路錯誤，請再試一次', 3500);
      });
  });

  // ESC to close
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modal.classList.contains('wh-open')) closeModal();
  });
})();
