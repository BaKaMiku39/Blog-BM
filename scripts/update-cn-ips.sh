#!/usr/bin/env bash
# 生成「中国 IP 段」清单，供 nginx geo 使用（只放行清单内的地址）。
# 数据源用国内可达的镜像：clang.cn（中国）+ ipdeny（港澳台），避免 APNIC 官方源在国内龟速。
# 用法：sudo /usr/local/bin/update-cn-ips.sh
set -euo pipefail

OUT="/etc/nginx/snippets/cn-ips.conf"
TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT

fetch() { curl -fsS --retry 2 --max-time 30 -o "$TMPDIR/$2" "$1"; }

fetch "https://ispip.clang.cn/all_cn.txt" cn.txt
for c in hk mo tw; do
  fetch "https://www.ipdeny.com/ipblocks/data/countries/$c.zone" "$c.zone" || echo "警告：$c 段下载失败，跳过" >&2
done

{
  echo "# 自动生成，勿手改 —— /usr/local/bin/update-cn-ips.sh"
  echo "# 数据源：ispip.clang.cn（中国大陆）+ ipdeny.com（港澳台）"
  echo "# 生成时间：$(date -Iseconds)"
  cat "$TMPDIR"/cn.txt "$TMPDIR"/hk.zone "$TMPDIR"/mo.zone "$TMPDIR"/tw.zone 2>/dev/null \
    | grep -E '^[0-9]{1,3}(\.[0-9]{1,3}){3}/[0-9]{1,2}$' \
    | sort -u \
    | awk '{print $1" 1;"}'
} > "$TMPDIR/new.conf"

install -m 0644 "$TMPDIR/new.conf" "$OUT"
nginx -t
systemctl reload nginx
echo "已更新 $(grep -c ' 1;' "$OUT") 条中国 IP 段"
