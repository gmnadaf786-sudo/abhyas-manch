/* PDF/प्रिंट फाइलचे नाव: window.print() वेळी पानाचे title तात्पुरते बदलते (ब्राउझर तेच नाव PDF ला देतो) */
(function(){
 function cl(s){return String(s||'').replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}]/gu,'').replace(/[\\\/:*?"<>|\n\r\t]+/g,' ').replace(/\s+/g,' ').trim()}
 window.pdfClean=cl;
 var _p=window.print.bind(window);
 window.print=function(){
  var o=document.title,n='';
  try{n=window.PDFT||(window.pdfAuto?window.pdfAuto():'')}catch(e){}
  n=cl(n).slice(0,110);if(n)document.title=n;
  var ap=window.onafterprint;
  window.onafterprint=function(){document.title=o;window.onafterprint=ap||null;if(ap)try{ap.apply(this,arguments)}catch(e){}};
  _p();
 };
})();
