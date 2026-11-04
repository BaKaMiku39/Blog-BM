---
title: '把站点搬到一台很小的服务器上'
description: '不是静态站，是 Node SSR。部署命令里那个被我删掉的 --delete，救了服务器上所有写过的文章。'
category: 项目
tags:
  - 部署
  - nginx
  - systemd
date: '2026-10-18'
cover: '/images/cover-small-server.webp'
badge: ''
draft: false
publishedAt: '2026-10-18T10:15:00.000Z'
updatedAt: ''
---
博客一开始是纯静态的：写完 md，构建，把 `dist` 传上去，完事。

后来加了个后台，可以在网页上直接写文章、传图。文章存在 `data/posts/*.md`，图片存在 `data/uploads/`——**这些东西在服务器上，不在我的电脑上**。

从那一刻起，它就不是静态站了。

## 结构

```
nginx  →  /            →  反代 127.0.0.1:4321
          /meting/api  →  反代 127.0.0.1:3030（音乐接口）

systemd: bakamiku.service → node ./dist/server/entry.mjs
```

Astro 用 `output: 'server'` + `@astrojs/node` 的 standalone 模式，跑起来就是一个普通的 Node 进程。nginx 只负责两件事：把 80 端口的请求转给它，以及开 gzip。

用 systemd 而不是 `pm2` / `screen`，理由很朴素：**开机自启、崩了自动拉起来、日志用 `journalctl` 就能看**。少装一个东西。

## 部署

```bash
tar czf - dist | ssh ubuntu@<host> \
  'tar xzf - -C /opt/bakamiku && sudo chmod -R a+rX /opt/bakamiku/dist \
   && sudo systemctl restart bakamiku && sleep 3 && systemctl is-active bakamiku'
```

几处刻意的选择：

- **管道传，不落临时文件**。本地 `tar` 直接喂给远端 `tar`，省一次上传再解压。
- **没有 `--delete`**。这条最重要。如果加了，远端 `dist` 里多出来的文件会被删——而 `data/` 是后台写的、不在 `dist` 里，删不到它，但任何排在 `data` 之外的东西都会有风险。宁可留一点旧文件。
- **`chmod a+rX`**。`tar` 解出来的权限跟着本机走，nginx 和 node 是别的用户，读不到就成了 403。
- **`sleep 3 && systemctl is-active`**。部署脚本必须自己验证。不然「命令成功退出」和「服务真的起来了」是两件事。
- **`.env` 由 systemd 读**。只写 `KEY=value` 单行，不要引号、不要行内注释——`EnvironmentFile` 不是 shell，加了引号会把引号当成值的一部分。

## 后台写的东西，不能跟着部署走

这是整件事里最容易翻车的地方：**部署会覆盖代码，但不能覆盖内容**。

所以目录分得很清楚：

- `/opt/bakamiku/dist` —— 我在本地构建，部署时**每次覆盖**
- `/opt/bakamiku/data` —— 后台在网页上写，部署时**从来不碰**

`data` 在 `dist` 外面，所以解压 `dist` 永远碰不到它。这条如果搞反了——比如把上传目录放在 `public/` 里——每次发版都会把用户的图洗掉。

## 一个小遗憾

`data/` 现在是纯文件，没有备份。

想加的话最省事的不是写脚本，是 `cron` 里一行：

```bash
0 4 * * * tar czf /opt/backup/data-$(date +\%F).tgz -C /opt/bakamiku data
```

每天四点打一个包，留七天。等哪天真的丢了东西再补，就晚了。

## 记下来

- 有后台写入的项目，部署脚本的第一优先级是「不碰数据」，第二才是「更新代码」。
- 部署脚本要自带验证，`is-active` 比 exit code 诚实。
- 便宜服务器也够用。这个站一天几十个访问，1 核 2G 跑得很闲，瓶颈从来不在机器上。
