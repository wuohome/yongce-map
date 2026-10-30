// 問題回報按鈕：本體統一放 wuohome.github.io/ragic/bug-report.js，改一次全站生效；這裡只放本站設定
window.WH_BUG_REPORT = Object.assign({ screenshot: true }, window.WH_BUG_REPORT);
(function () {
  var s = document.createElement('script');
  s.src = 'https://wuohome.github.io/ragic/bug-report.js';
  document.head.appendChild(s);
})();
