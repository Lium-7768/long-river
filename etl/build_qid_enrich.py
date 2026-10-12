#!/usr/bin/env python3
"""补数据C13：用 Wikidata Q-ID 丰富人物——职业/籍贯/精确生卒。

对已匹配 qid 的人物，批量拉 P106(职业)/P19(籍贯)/P569(生)/P570(卒)。
产出：person_occupations(person_id, occupation)、person_birthplace(person_id, place)，
并回填 persons.birth_exact/death_exact（YYYY-MM-DD）。
"""
import sqlite3, os, json, urllib.request, urllib.parse, time, sys
DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "db", "lr-song.sqlite3")
EP = "https://query.wikidata.org/sparql"
UA = "long-river-research/1.0 (contact: dev@example.com)"
OP = urllib.request.build_opener(urllib.request.ProxyHandler())


def sparql(q):
    url = EP + "?" + urllib.parse.urlencode({'query': q, 'format': 'json'})
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'application/sparql-results+json'})
    return json.load(OP.open(req, timeout=90))


def main():
    con = sqlite3.connect(DB)
    con.execute("PRAGMA journal_mode=WAL")
    for c, t in [('birth_exact', 'TEXT'), ('death_exact', 'TEXT')]:
        if c not in [r[1] for r in con.execute("PRAGMA table_info(persons)")]:
            con.execute(f"ALTER TABLE persons ADD COLUMN {c} {t}")
    con.execute("DROP TABLE IF EXISTS person_occupations")
    con.execute("CREATE TABLE person_occupations(person_id TEXT, occupation TEXT)")
    con.execute("DROP TABLE IF EXISTS person_birthplace")
    con.execute("CREATE TABLE person_birthplace(person_id TEXT, place TEXT)")
    con.execute("CREATE INDEX idx_po_pid ON person_occupations(person_id)")
    con.execute("CREATE INDEX idx_pb_pid ON person_birthplace(person_id)")

    rows = con.execute("SELECT id,qid FROM persons WHERE qid IS NOT NULL").fetchall()
    print(f"待丰富 {len(rows)} 人")
    lim = int(sys.argv[1]) if len(sys.argv) > 1 else len(rows)
    rows = rows[:lim]
    occ_n = bp_n = ex_n = 0
    CH = 60
    for s in range(0, len(rows), CH):
        chunk = rows[s:s + CH]
        vals = " ".join("wd:" + q for _, q in chunk)
        q = f'''SELECT ?p ?occLabel ?bplaceLabel ?bd ?dd WHERE {{
          VALUES ?p {{ {vals} }}
          OPTIONAL {{ ?p wdt:P106 ?occ }}
          OPTIONAL {{ ?p wdt:P19 ?bplace }}
          OPTIONAL {{ ?p wdt:P569 ?bd }}
          OPTIONAL {{ ?p wdt:P570 ?dd }}
          SERVICE wikibase:label {{ bd:serviceParam wikibase:language "zh". }} }}'''
        try:
            res = sparql(q)
        except Exception:
            time.sleep(3)
            continue
        qid2pid = {}
        for pid, qq in chunk:
            qid2pid.setdefault(qq, pid)
        seen_occ = set()
        seen_bp = set()
        for b in res['results']['bindings']:
            p = b['p']['value'].rsplit('/', 1)[-1]
            pid = qid2pid.get(p)
            if not pid:
                continue
            if 'occLabel' in b:
                oc = b['occLabel']['value']
                if (pid, oc) not in seen_occ and oc:
                    seen_occ.add((pid, oc))
                    con.execute("INSERT INTO person_occupations VALUES (?,?)", (pid, oc))
                    occ_n += 1
            if 'bplaceLabel' in b:
                pl = b['bplaceLabel']['value']
                if (pid, pl) not in seen_bp and pl:
                    seen_bp.add((pid, pl))
                    con.execute("INSERT INTO person_birthplace VALUES (?,?)", (pid, pl))
                    bp_n += 1
            if 'bd' in b:
                d = b['bd']['value'][:10]
                if d and d[0].isdigit():
                    con.execute("UPDATE persons SET birth_exact=? WHERE id=?", (d, pid))
                    ex_n += 1
            if 'dd' in b:
                d = b['dd']['value'][:10]
                if d and d[0].isdigit():
                    con.execute("UPDATE persons SET death_exact=? WHERE id=?", (d, pid))
        con.commit()
        if s % 600 == 0:
            print(f"  {s}/{len(rows)} … occ {occ_n} bp {bp_n}")
        time.sleep(0.3)
    con.commit()
    print(f"\n✓ occupations {occ_n}，birthplace {bp_n}，精确生卒 {ex_n}")
    con.close()


if __name__ == "__main__":
    main()
