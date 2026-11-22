#!/usr/bin/env python3
"""महाराष्ट्र शाळा Master Excel (All Schools शीट) वरून data/udise/*.json व geo.json बनवते.

वापर (repo च्या मुख्य फोल्डरमधून):
    python3 tools/build_udise.py "Maharashtra_School_Master_2026-27.xlsx"
(openpyxl लागते.) दरवर्षी नवी यादी आल्यावर हीच स्क्रिप्ट पुन्हा चालवा.

data/udise/<UDISE चे पहिले ६ अंक>.json  →  { UDISE चे शेवटचे ५ अंक : [ ... ] }
 0 शाळेचे नाव          1 जिल्हा (English)     2 पिन          3 खालचा वर्ग     4 वरचा वर्ग
 5 केंद्र कोड (CLU…)   6 ब्लॉक/तालुका कोड     7 गाव/वॉर्ड    8 R=ग्रामीण U=शहरी
 9 अक्षांश (lat)       10 रेखांश (lng)       11 स्थिती: ''=सुरू C=बंद P=कायमची बंद M=विलीन S=मंजूर पण सुरू नाही D=DCF नाही
 12 व्यवस्थापन         13 B=मुले G=मुली C=मिश्र   14 पत्ता
 (०–४ ची रचना जुन्या कोडसाठी आधीसारखीच ठेवली आहे.)

geo.json  →  [ {n: जिल्हा, c: जिल्हा कोड, t: [ {n: तालुका, b: [ब्लॉक कोड…], k: [[केंद्राचे नाव, जुना anchor कोड किंवा '', CLU कोड]…]} ]} ]
 केंद्रे फक्त त्या ब्लॉकच्या सुरू शाळांवरून घेतली आहेत. मराठी नावे tools/mr_names.json मधून.

data/clu/<जिल्हा कोड>.json  →  { केंद्र कोड (CLU…) : [[UDISE, शाळेचे नाव], …] }  (फक्त सुरू शाळा)
 केंद्रप्रमुख नोंदणी मंजूर झाल्यावर worker.js यावरून त्या केंद्राच्या शाळा आपोआप जोडते.
"""
import sys, os, re, json, glob, collections
import openpyxl

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ST = {'Operational': '', 'Closed': 'C', 'Permanently Closed': 'P', 'Merged': 'M',
      'Sanctioned but not Operational': 'S', 'DCF not Received': 'D'}
TY = {'1-Boys': 'B', '2-Girls': 'G', '3-Co-educational': 'C'}


def clean(s):
    return re.sub(r'\s+', ' ', str(s or '')).strip()


def title(s):
    s = clean(s)
    return ' '.join(w[:1].upper() + w[1:].lower() for w in s.split(' '))


def clu(x):
    """वैध केंद्र कोड (CLU + अंक) नाहीतर '' – काही नोंदींमध्ये रिकामा किंवा ब्लॉक कोड टाकलेला असतो."""
    x = clean(x)
    return x if re.match(r'^CLU\d+$', x) else ''


def num(x):
    try:
        return int(float(x))
    except Exception:
        return 0


def coord(r):
    try:
        la, ln = float(r['Latitude']), float(r['Longitude'])
    except Exception:
        return None, None
    if 15.5 <= la <= 22.1 and 72.6 <= ln <= 80.95:  # महाराष्ट्राबाहेरचे चुकीचे लोकेशन वगळा
        return round(la, 6), round(ln, 6)
    return None, None


def main(xlsx):
    wb = openpyxl.load_workbook(xlsx, read_only=True)
    rows = list(wb['All Schools'].iter_rows(values_only=True))
    h = rows[0]
    R = [dict(zip(h, r)) for r in rows[1:] if r and r[0]]
    mr = json.load(open(os.path.join(ROOT, 'tools', 'mr_names.json'), encoding='utf-8'))

    # ---- data/udise ----
    files = collections.defaultdict(dict)
    for r in R:
        u = str(r['UDISE Code']).strip()
        la, ln = coord(r)
        ru = {'Rural': 'R', 'Urban': 'U'}.get(r['Rural / Urban'] or '', '')
        files[u[:6]][u[6:]] = [
            clean(r['School Name']), title(r['District']), clean(r['PIN Code']),
            num(r['Class From']), num(r['Class To']),
            clu(r['Cluster Code']), clean(r['Block/Taluka Code']), title(r['Village / Ward']), ru,
            la, ln, ST.get(r['School Status'], 'D'),
            clean(r['Management Description (State)'] or r['Management Description']),
            TY.get(r['School Type'], ''), clean(r['Address'])]
    out = os.path.join(ROOT, 'data', 'udise')
    for f in glob.glob(os.path.join(out, '*.json')):
        os.remove(f)
    for p, d in files.items():
        with open(os.path.join(out, p + '.json'), 'w', encoding='utf-8') as f:
            json.dump(dict(sorted(d.items())), f, ensure_ascii=False, separators=(',', ':'))

    # ---- geo.json ----
    dn = {}   # जिल्हा कोड → English नाव
    for r in R:
        dn[str(r['District Code'])] = title(r['District'])
    blk_name = {}
    for r in R:
        blk_name[str(r['Block/Taluka Code'])] = title(r['Taluka / Block'])
    cl = collections.defaultdict(dict)   # ब्लॉक → {CLU: नाव}
    blk_dist = {}
    for r in R:
        b = str(r['Block/Taluka Code'])
        blk_dist[b] = str(r['District Code'])
        if r['School Status'] == 'Operational' and clu(r['Cluster Code']):
            cl[b][clu(r['Cluster Code'])] = title(r['Cluster / Centre'])
    geo = []
    for dc in sorted(dn, key=lambda c: (mr['district'].get(c) is None, mr['district'].get(c, dn[c]))):
        tal = collections.OrderedDict()   # तालुका नाव → {b:[], k:{}}
        for b in sorted(x for x in blk_dist if blk_dist[x] == dc):
            nm = mr['block'].get(b) or blk_name[b]
            t = tal.setdefault(nm, {'b': [], 'k': {}})
            t['b'].append(b)
            t['k'].update(cl.get(b, {}))
        ts = []
        for nm in sorted(tal):
            ks = sorted(tal[nm]['k'].items(), key=lambda x: x[1].lower())
            ts.append({'n': nm, 'b': tal[nm]['b'], 'k': [[n_, mr['anchor'].get(c, ''), c] for c, n_ in ks]})
        geo.append({'n': mr['district'].get(dc) or dn[dc], 'c': dc, 't': ts})
    with open(os.path.join(ROOT, 'geo.json'), 'w', encoding='utf-8') as f:
        json.dump(geo, f, ensure_ascii=False, separators=(',', ':'))
    # data/clu : जिल्हा → केंद्र → सुरू शाळा (केंद्रप्रमुख मंजुरीसाठी)
    cdir = os.path.join(ROOT, 'data', 'clu')
    os.makedirs(cdir, exist_ok=True)
    for f in glob.glob(os.path.join(cdir, '*.json')):
        os.remove(f)
    byd = collections.defaultdict(lambda: collections.defaultdict(list))
    for r in R:
        c = clu(r['Cluster Code'])
        if r['School Status'] == 'Operational' and c:
            byd[str(r['District Code'])][c].append([str(r['UDISE Code']).strip(), clean(r['School Name'])])
    for dc, m in byd.items():
        with open(os.path.join(cdir, dc + '.json'), 'w', encoding='utf-8') as f:
            json.dump({k: sorted(v) for k, v in sorted(m.items())}, f, ensure_ascii=False, separators=(',', ':'))
    print('शाळा', len(R), '| फाइल्स', len(files), '| जिल्हे', len(geo),
          '| तालुके', sum(len(d['t']) for d in geo), '| केंद्रे', sum(len(t['k']) for d in geo for t in d['t']))


if __name__ == '__main__':
    main(sys.argv[1])
