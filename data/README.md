# 数据备份

## 文件
| 文件 | 大小 | 进 git | 说明 |
|---|---|---|---|
| `lr-song.sql.gz` | ~3.7 MB | ✅ | 宋辽金夏库的压缩 SQL 备份（权威快照） |
| `lr-song.sqlite3` | ~33 MB | ❌ | 解压后的本地 SQLite（`.gitignore`，随时重建） |

## 为什么同时留两份
- **`.sql.gz`（3.7MB）**：压缩后进 git，clone 即得备份；体积小，可版本化
- **`.sqlite3`（33MB）**：直接可用，但不进 git（避免仓库历史膨胀）；由 `.sql.gz` 恢复

## 恢复本地 SQLite
```bash
gunzip -c data/lr-song.sql.gz | sqlite3 data/lr-song.sqlite3
```

## 从 D1 重新导出（当 D1 有更新时）
```bash
CLOUDFLARE_API_TOKEN=xxx bash etl/dump_db.sh lr-song
# 然后重新生成压缩备份：
sqlite3 data/lr-song.sqlite3 ".dump" | gzip -9 > data/lr-song.sql.gz
```

## 用途
D1 是线上部署副本；本地 SQLite 是**权威备份**。若 D1 出问题（额度/故障），
可用本地库重建，或改后端指向本地 SQLite。
