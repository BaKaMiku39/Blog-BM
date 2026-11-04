---
title: '302KB 的 CSS，被我改成 58KB 传出去'
description: '优化前先量一遍。我第一次打开自己的站，第一屏白了一下，问题不在代码，在服务器上少配的三行。'
category: 技术笔记
tags:
  - 性能
  - nginx
  - Astro
date: '2026-11-01'
cover: ''
badge: ''
draft: false
publishedAt: '2026-11-01T14:12:00.000Z'
updatedAt: ''
---
第一次用手机流量打开自己的站，第一屏白了一下，然后才出现插画。

不算慢，但那一下空白很扎眼。我当时的反应是「CSS 太大了，得拆」，差点就开始动手重构 `global.css`。后来忍住了，先去量了一遍——幸好量了。

## 先量，别猜

第一步不是看代码，是看响应头：

```bash
curl -sI https://你的域名/_astro/index.xxxx.css | grep -i 'content-length\|content-encoding'
```

结果两个都没有。

没有 `content-encoding`，意思是这份 CSS 是**裸传**的——一个字节都没压。302KB 的样式表，原封不动地发给每一个访客。

问题是它本来可以只有原来的五分之一。

## 三行配置

nginx 默认只对 `text/html` 开 gzip，`text/css`、JS、JSON 这些都不在名单里。

所以改的其实是服务器，不是代码：

```nginx
gzip on;
gzip_types text/css application/javascript application/json image/svg+xml;
gzip_vary on;
```

`gzip_vary on` 这行别省。它在响应里加上 `Vary: Accept-Encoding`，否则中间的缓存可能把压缩版发给不支持的客户端，或者反过来——一个很难查的坑。

改完 `nginx -t`，`systemctl reload nginx`，同样的地址再拉一次：

- 改之前：**302KB**
- 开了 gzip：**113KB**
- 换了字体之后：**58KB**

一行代码没动，传输量掉到五分之一。

后面那 113KB → 58KB 是另一件事：把 `@fontsource/noto-sans-sc` 换成可变字重版本，CSS 里 `@font-face` 从 202 条降到 101 条，请求数 20 → 13。

## 一个反直觉的结论

换可变字体这件事，我以为字体文件会变小。

实测不是：`@font-face` 少了，请求少了，但**字体总字节从 609KB 涨到 663KB**——可变字重的 CJK 分片本来就更大。CSS 加字体合计 722KB → 721KB，等于没变。

省下来的是请求数，不是字节。而请求数在 HTTP/2 下也没那么贵。

所以这次换字体的收益，本质是**排版质量**（600 字重比 700 好看），不是性能。如果当时不量，我会以为自己做了个性能优化。

## 顺手的一个大头像

同一批里还有个更夸张的：头像是 1254×1254 的 PNG，实际显示 76×76。

```bash
# 240×240 的 webp
sharp avatar.png → avatar.webp
```

107KB → 9.6KB。一张头像省下的流量，比整个 CSS 优化还多。

## 记下来的三条

1. **先看响应头，再看源码**。`content-encoding`、`content-length`、`cache-control` 三个字段能解释大部分「感觉有点慢」。
2. **gzip 只对文本有意义**。图片、字体、woff2 已经是压缩格式，再 gzip 只会浪费 CPU。
3. **优化要有数字**。改完必须再量一次，不然你只是在「做了些什么」，不是在「变快了」。
