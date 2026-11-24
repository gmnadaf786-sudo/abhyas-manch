/* विद्यार्थी यादी अपलोड (KP / मुख्याध्यापक): UDISE+ / सरल Excel किंवा CSV
   siUi(el, mode) — mode 'kp' : फाइलमधील UDISE कॉलमनुसार केंद्रातील शाळांना जोडते
                    mode 'hm' : सर्व विद्यार्थी आपल्या शाळेत (फाइलमध्ये UDISE असल्यास फक्त जुळणारे)
   गरज: api(url, body) व esc() पानावर उपलब्ध; KP साठी DATA (शाळा यादी) व CEN. */
var SIX = null;
function siUi(el, mode) {
  el.innerHTML = '<div class="card" style="border:2px solid var(--a)"><h2>⬆ विद्यार्थी यादी अपलोड</h2>' +
    '<p class="m" style="font-size:13px;margin:0 0 6px">UDISE+ किंवा सरल पोर्टलवरून डाउनलोड केलेली विद्यार्थी यादी (Excel .xlsx / .xls किंवा CSV) निवडा. ' +
    (mode === 'kp' ? 'फाइलमध्ये <b>UDISE Code</b> कॉलम असावा – प्रत्येक विद्यार्थी त्याच्या UDISE नुसार तुमच्या केंद्रातील शाळेला जोडला जाईल; केंद्राबाहेरील UDISE वगळले जातील. एका शाळेची फाइल असेल (UDISE कॉलम नसेल) तर खाली शाळा निवडा.'
      : 'सर्व विद्यार्थी तुमच्या शाळेत जोडले जातील (फाइलमध्ये UDISE कॉलम असल्यास फक्त तुमच्या शाळेचे).') +
    ' आधी नोंद असलेले विद्यार्थी (PEN) दुबार होत नाहीत; इयत्ता/तुकडी अपडेट होते. दुसऱ्या शाळेत नोंद असलेले विद्यार्थी हलवले जात नाहीत.</p>' +
    (mode === 'kp' ? '<label style="font-size:13px">शाळा (फाइलमध्ये UDISE कॉलम नसल्यास)<select id="siu"><option value="">– फाइलमधील UDISE वापरा –</option>' + DATA.filter(function (r) { return !FL || r.c === FL }).map(function (r) { return '<option value="' + r.u + '">' + esc(r.nm || r.u) + '</option>' }).join('') + '</select></label>' : '') +
    '<label style="font-size:13px">इयत्ता (फाइलमध्ये इयत्ता कॉलम नसल्यास)<select id="sic"><option value="">– फाइलमधून –</option>' + [1, 2, 3, 4, 5, 6, 7, 8].map(function (c) { return '<option>' + c + '</option>' }).join('') + '</select></label>' +
    '<input type="file" id="sif" accept=".xlsx,.xls,.csv"><button onclick="siRead(\'' + mode + '\')">📄 फाइल वाचा</button><div id="six" class="m" style="margin-top:8px"></div></div>';
}
function siRead(mode) {
  var f = document.getElementById('sif').files[0], ux = document.getElementById('six');
  if (!f) { ux.innerHTML = '<span class="er">फाइल निवडा.</span>'; return }
  ux.textContent = 'वाचत आहे…';
  function go() {
    var rd = new FileReader();
    rd.onload = function () {
      try {
        var wb = XLSX.read(rd.result, { type: 'array' }), ws = wb.Sheets[wb.SheetNames[0]], A = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        var nz = function (s) { return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, '') }, m0 = '', i;
        for (i = 0; i < Math.min(8, A.length); i++) { var mm = String(A[i][0] || '').match(/\d{11}/); if (mm && !m0) m0 = mm[0] }
        var AL = { udisecode: 'udise', udise: 'udise', schooludisecode: 'udise', udisecodeofschool: 'udise', schooludise: 'udise', udiseno: 'udise', class: 'cls', standard: 'cls', grade: 'cls', gradename: 'cls', studentgrade: 'cls', currentgrade: 'cls', classname: 'cls', studentclass: 'cls', currentclass: 'cls', std: 'cls', classgrade: 'cls', gradeclass: 'cls', sectionname: 'div', studentsection: 'div', division: 'div', section: 'div', name: 'name', studentname: 'name', studentpen: 'pen', studentid: 'pen', pen: 'pen', gender: 'gender', studentgender: 'gender', sex: 'gender', socialcategory: 'cat', category: 'cat', fathername: 'father', fathersname: 'father', mothername: 'mother', mothersname: 'mother', guardianname: 'guardian', dob: 'dob', birthdate: 'dob', dateofbirth: 'dob', address: 'addr', pincode: 'pin', mobileno: 'mobile', mobile: 'mobile', alternatemobileno: 'mobile2', contactemailid: 'email', mothertongue: 'tongue', minoritygroup: 'minority', minority: 'minority', bplbeneficiary: 'bpl', bpl: 'bpl', ewsdisadvantagedgroup: 'ews', cwsn: 'cwsn', typeofimpairments: 'imp', bloodgroup: 'blood', admissionno: 'gr', grno: 'gr', genregno: 'gr', admissiondate: 'adate', mediumofinstruction: 'medium', medium: 'medium', apaarid: 'apaar', apaarstatus: 'apst', caste: 'caste', rte: 'rte', rollno: 'roll' };
        var hi = -1, H = null;
        for (i = 0; i < Math.min(25, A.length) && hi < 0; i++) { var h = A[i].map(function (x) { return AL[nz(x)] || '' }), c = h.filter(Boolean).length; if (c >= 3 && h.indexOf('name') >= 0) { hi = i; H = h } }
        if (hi < 0) { ux.innerHTML = '<span class="er">ही विद्यार्थी-यादी फाइल ओळखता आली नाही (नाव/इयत्ता कॉलम हवेत).</span>'; return }
        var RM = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8 }, CM = { GENERAL: 'GEN', GEN: 'GEN', OPEN: 'GEN', SC: 'SC', ST: 'ST', VJA: 'VJA', 'VJ-A': 'VJA', 'VJ/NT-A': 'VJA', NTB: 'NTB', 'NT-B': 'NTB', NTC: 'NTC', 'NT-C': 'NTC', NTD: 'NTD', 'NT-D': 'NTD', OBC: 'OBC', SBC: 'SBC' }, dc = document.getElementById('sic').value;
        var iso = function (v) { if (typeof v === 'number' && v > 20000) { var d = new Date(Math.round((v - 25569) * 864e5)); return d.toISOString().slice(0, 10) } var s = String(v || '').trim(), q = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/); if (q) return q[3] + '-' + ('0' + q[2]).slice(-2) + '-' + ('0' + q[1]).slice(-2); return /^\d{4}-\d\d-\d\d/.test(s) ? s.slice(0, 10) : '' };
        var fixU = (mode === 'kp' ? document.getElementById('siu').value : '') || '', hasU = H.indexOf('udise') >= 0;
        var G = {}, bad = 0, noU = 0, tot = 0;
        for (var k = hi + 1; k < A.length; k++) {
          var r = A[k], o = {}; H.forEach(function (key, ci) { if (key && o[key] === undefined) o[key] = String(r[ci] == null ? '' : r[ci]).trim() });
          var sv = H.indexOf('dob') >= 0 ? r[H.indexOf('dob')] : '';
          var cs = String(o.cls || dc || '').replace(/^(grade|class|std|standard|इयत्ता)\s*[-:]?\s*/i, '').replace(/^(\d+)\s*(st|nd|rd|th)?$/i, '$1').trim().toUpperCase(), cn = RM[cs] || (/^[1-8]$/.test(cs) ? +cs : 0), nm = o.name;
          if (!nm || /^\(\d+\)$/.test(String(o.cls))) continue;
          if (!cn) { bad++; continue }
          var u = fixU || String(o.udise || '').replace(/\D/g, '') || (mode === 'kp' && !hasU ? m0 : '');
          if (mode === 'kp' && u.length !== 11) { noU++; continue }
          if (mode === 'hm') u = hasU ? String(o.udise || '').replace(/\D/g, '') : '_';
          var pen = String(o.pen || '').replace(/\D/g, ''); if (pen.length !== 11) pen = '';
          var g = String(o.gender || '').toLowerCase()[0], ct = String(o.cat || '').replace(/^\d+\s*-\s*/, '').trim().toUpperCase();
          var x = {}; ['caste', 'minority', 'bpl', 'ews', 'cwsn', 'imp', 'blood', 'adate', 'medium', 'rte', 'apaar', 'apst', 'email', 'guardian', 'pin'].forEach(function (key) { var v = String(o[key] || '').trim(); if (key === 'minority' || key === 'caste' || key === 'imp') v = v.replace(/^\d+\s*-\s*/, ''); if (v && !/^(NA|0|0\.0)$/i.test(v) && !/^Under Investigation/i.test(v)) x[key] = v });
          var mo = String(o.mobile || '').replace(/\D/g, '');
          (G[u] = G[u] || []).push({ cls: cn, div: (o.div || 'A').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2) || 'A', name: nm, pen: pen, gender: g === 'm' ? 'M' : g === 'f' ? 'F' : g ? 'O' : '', cat: CM[ct.replace(/\s+/g, '')] || CM[ct] || '', father: o.father === 'NA' ? '' : o.father, mother: o.mother === 'NA' ? '' : o.mother, addr: o.addr === 'NA' ? '' : o.addr, mobile: mo.length === 10 ? mo : '', dob: (o.dob || sv) ? iso(sv) : '', gr: o.gr || '', tongue: (o.tongue || '').replace(/^\d+\s*-\s*/, '').replace(/\s*-.*$/, '').trim(), x: x });
          tot++;
        }
        var us = Object.keys(G), mine = {}, out = 0;
        if (mode === 'kp') DATA.forEach(function (d) { mine[d.u] = d.nm || d.u });
        var list = us.map(function (u) { var ok = mode === 'hm' ? true : !!mine[u]; if (!ok) out += G[u].length; return { u: u, n: G[u].length, ok: ok } });
        if (!tot) { ux.innerHTML = '<span class="er">फाइलमध्ये विद्यार्थी सापडले नाहीत' + (noU ? ' (UDISE कॉलम नाही – वर शाळा निवडा)' : '') + '.</span>'; return }
        SIX = { mode: mode, G: G, list: list };
        var okN = list.filter(function (x) { return x.ok }).reduce(function (a, x) { return a + x.n }, 0);
        ux.innerHTML = '<b>' + tot + ' विद्यार्थी सापडले</b>' + (mode === 'kp' ? ' · ' + list.filter(function (x) { return x.ok }).length + ' शाळा' : '') +
          (mode === 'kp' ? '<div style="margin:6px 0;max-height:220px;overflow:auto;border:1px solid var(--l);border-radius:8px;padding:4px 8px">' + list.map(function (x) { return '<div style="padding:3px 0;border-bottom:1px solid var(--l);font-size:13px">' + (x.ok ? '✅ ' + esc(mine[x.u]) : '⛔ <span class="no">केंद्राबाहेर</span>') + ' <small class="m">' + x.u + '</small> – ' + x.n + '</div>' }).join('') + '</div>' : '') +
          (out ? '<span class="no">' + out + ' विद्यार्थी केंद्राबाहेरील UDISE चे – वगळले जातील.</span><br>' : '') + (noU ? '<span class="no">' + noU + ' ओळींना UDISE नाही – वगळल्या.</span><br>' : '') + (bad ? '<span class="no">' + bad + ' ओळींना इयत्ता (1-8) नाही – वगळल्या.</span><br>' : '') +
          (okN ? '<button onclick="siSend()">✔ ' + okN + ' विद्यार्थी आयात करा</button>' : '<span class="er">आयात करण्यासारखे विद्यार्थी नाहीत.</span>') + '<div id="sip"></div>';
      } catch (e) { ux.innerHTML = '<span class="er">फाइल वाचता आली नाही.</span>' }
    };
    rd.readAsArrayBuffer(f);
  }
  if (window.XLSX) go(); else { var s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; s.onload = go; s.onerror = function () { ux.innerHTML = '<span class="er">इंटरनेट अडचण, पुन्हा प्रयत्न करा.</span>' }; document.head.appendChild(s) }
}
function siSend() {
  var X = SIX; if (!X) return; var jobs = [];
  X.list.forEach(function (x) { if (!x.ok) return; var R = X.G[x.u]; for (var i = 0; i < R.length; i += 100) jobs.push({ u: x.u, rows: R.slice(i, i + 100) }) });
  var p = document.getElementById('sip'), k = 0, n = 0, pn = 0, sk = 0, rt = 0, url = X.mode === 'kp' ? '/api/o/uimport' : '/api/s/uimport';
  [].forEach.call(document.querySelectorAll('#six button'), function (b) { b.disabled = true });
  (function nx() {
    if (k >= jobs.length) { p.innerHTML = '<p style="color:#0f766e"><b>✅ पूर्ण: ' + n + ' विद्यार्थी आयात/अपडेट झाले.</b>' + (pn ? '<br>' + pn + ' जणांना PEN नाही – नाव/वर्गावरून जुळवण्यासाठी राखून ठेवले.' : '') + (sk ? '<br>' + sk + ' वगळले (चुकीची माहिती किंवा दुसऱ्या शाळेत आधीच नोंद).' : '') + '</p>'; if (typeof rfr === 'function' && X.mode === 'kp') { VD = null; VST = null } return }
    var j = jobs[k], b = { rows: j.rows, last: k === jobs.length - 1 ? 1 : 0, udise: j.u };
    p.textContent = 'पाठवत आहे… ' + (k + 1) + ' / ' + jobs.length;
    api(url, b).then(function (r) { if (!r || (!r.ok && r.e !== 'na')) throw 0; if (r.ok) { n += r.n || 0; pn += r.pn || 0; sk += r.sk || 0 } else sk += j.rows.length; k++; rt = 0; nx() })
      .catch(function () { if (++rt <= 5) { p.textContent = 'अडचण, पुन्हा प्रयत्न ' + rt + '…'; setTimeout(nx, 2000 * rt) } else p.innerHTML = '<span class="er">इंटरनेट अडचण. पुन्हा "आयात करा" दाबा (आधी झालेले दुबार होणार नाहीत).</span>' })
  })();
}
