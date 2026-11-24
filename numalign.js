/* तक्त्यांमधील आकडे उजवीकडे संरेखित (एक अंकी संख्या दोन अंकी संख्येच्या एकक स्थानाखाली) */
(function(){var N=/^\s*[-–]?\s*[₹]?\s*[0-9०-९][0-9०-९,.]*\s*(%|\/\s*[0-9०-९]+)?\s*$/,busy=false;
function run(){busy=false;var T=document.querySelectorAll('table:not([data-na])');for(var i=0;i<T.length;i++){var t=T[i],rows=t.rows,cols={};if(!rows||!rows.length)continue;
 for(var r=0;r<rows.length;r++){var cs=rows[r].cells;for(var c=0;c<cs.length;c++){var td=cs[c];if(td.tagName!=='TD'||td.colSpan>1)continue;var x=td.textContent.trim();if(!x)continue;var o=cols[c]||(cols[c]={n:0,t:0});o.t++;if(N.test(x))o.n++}}
 for(var r=0;r<rows.length;r++){var cs=rows[r].cells;for(var c=0;c<cs.length;c++){var o=cols[c];if(!o||!o.t||o.n<o.t||cs[c].colSpan>1)continue;cs[c].style.textAlign='right';cs[c].style.fontVariantNumeric='tabular-nums';cs[c].style.paddingRight='12px'}}
 t.setAttribute('data-na','1')}}
function q(){if(busy)return;busy=true;(window.requestAnimationFrame||setTimeout)(run)}
if(window.MutationObserver)new MutationObserver(q).observe(document.documentElement,{childList:true,subtree:true});document.addEventListener('DOMContentLoaded',q);q()})();
