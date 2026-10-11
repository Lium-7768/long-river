#!/usr/bin/env python3
"""结构修复（一次性）：CBDB 0→NULL、越界清理、颠倒交换、zi JSON→裸串、gaoli→NULL。
可重复运行（幂等）。"""
import sqlite3, json, sys

def main(db="data/lr-song.sqlite3"):
    con=sqlite3.connect(db)
    # 1. CBDB 用 0 表示未知 → NULL
    n1=con.execute("UPDATE persons SET birth=NULL WHERE birth=0").rowcount
    n2=con.execute("UPDATE persons SET death=NULL WHERE death=0").rowcount
    # 2. 生卒越界
    n3=con.execute("UPDATE persons SET birth=NULL WHERE birth>2030 OR birth<-3000").rowcount
    n4=con.execute("UPDATE persons SET death=NULL WHERE death>2030 OR death<-3000").rowcount
    # 3. 颠倒交换
    n5=0
    for pid,b,d in con.execute("SELECT id,birth,death FROM persons WHERE birth IS NOT NULL AND death IS NOT NULL AND birth>death").fetchall():
        con.execute("UPDATE persons SET birth=?,death=? WHERE id=?",(d,b,pid)); n5+=1
    # 4. zi JSON数组 → 裸串
    n6=0
    for pid,z in con.execute("SELECT id,zi FROM persons WHERE zi LIKE '[%'").fetchall():
        try:
            a=json.loads(z); v=a[0] if isinstance(a,list) and a else None
            con.execute("UPDATE persons SET zi=? WHERE id=?",(v,pid)); n6+=1
        except Exception: pass
    # 5. 非法 dynasty_id → NULL
    LEGAL=("xia","shang","zhou-w","zhou-e","qin","han-w","xin","han-e","sanguo","jin",
           "nanbei","sui","tang","wudai","liao","song-w","xixia","jin-chao","song-e",
           "yuan","ming","qing")
    q=f"UPDATE persons SET dynasty_id=NULL WHERE dynasty_id IS NOT NULL AND dynasty_id NOT IN ({','.join('?'*len(LEGAL))})"
    n7=con.execute(q,LEGAL).rowcount
    con.commit()
    print(f"✓ 修复: birth0={n1} death0={n2} 越界={n3+n4} 颠倒={n5} ziJSON={n6} 非法朝代={n7}")
    con.close()

if __name__=="__main__": main()
