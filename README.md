# 寻仙音乐资料库

《寻仙》游戏音乐与音效资料库，可检索和试听 148 首背景音乐与 6,266 条音效。本地开发只读使用
`original_data/`，生产站点通过 Cloudflare Worker 与私有 R2 提供试听。

## 启动

```bash
pnpm install
pnpm catalog:build
pnpm dev
```

浏览器打开 <http://localhost:3000>。网站服务使用 3000 端口，本地音频服务使用 8787 端口；根目录的 `pnpm dev` 会同时启动两者。

## 常用命令

```bash
pnpm catalog:build  # 重新读取本地音频并生成目录
pnpm audio:transcode # 生成部署用 Opus 与 MP3 试听文件（支持断点续跑）
pnpm check          # 目录、类型、代码、构建与页面检查
pnpm build          # 生成可部署的网站构建
```

`original_data/` 是只读归档。目录生成和播放流程不会修改其中的文件。

## 生成 R2 试听音频

安装 FFmpeg 后运行：

```bash
pnpm audio:transcode
```

生成物位于被 Git 忽略的 `generated/audio/v1/`。私有清单写入
`generated/manifests/audio-v1.json`，报告写入 `generated/reports/`。对象 Key
由完整源相对路径（包含扩展名）生成稳定哈希，因此同名 OGG 与 WAV 不会冲突。
当完整 Manifest 存在时，`pnpm catalog:build` 会让公开目录和本地媒体服务使用
Opus/MP3 试听 Key；没有 Manifest 的普通开发环境仍会安全回退到只读原始文件。

常用选项：

```bash
pnpm audio:transcode -- --formats=opus # 仅生成首选 Opus
pnpm audio:transcode -- --jobs=2       # 降低并发和 CPU 占用
pnpm audio:transcode -- --force        # 忽略已有清单，强制重新转码
```

转码成功后，生成可安全进入源码和 Worker Bundle 的部署映射：

```bash
pnpm audio:deployment-map
```

该命令只导出稳定 ID、R2 Key、格式和 MIME，不包含原始路径、绝对路径、音频内容或密钥。

## 私有 R2 音频网关

生产站点使用 `https://music.xunxian.wiki`，网页、签名接口和音频路径由同一个
Cloudflare Worker 提供，保持同源访问；旧 `workers.dev` 地址以 `308` 永久重定向到正式域名，版本预览地址关闭。

网站 Worker 使用逻辑 Binding `AUDIO_BUCKET`，提供：

- `GET /api/audio-url?key=...`：为允许列表中的音频生成 10 分钟签名 URL；
- `GET /audio/v1/...`：验证签名后从私有 R2 读取；
- `HEAD /audio/v1/...` 与单段 `Range` 请求；
- 通过不含签名参数的内部 Key 缓存完整音频，热缓存的完整与 Range 请求不再读取 R2；
- 签名接口每个客户端每分钟 30 次、音频接口每个客户端每分钟 180 次，超限返回 `429`；
- CSP、HSTS、点击劫持防护、权限策略和 Referrer Policy 等生产安全响应头；
- `AUDIO_ENABLED=false` 紧急关闭开关。

站点公开 `robots.txt` 与 `sitemap.xml`，四个主要页面均声明 `music.xunxian.wiki`
canonical 地址，并使用专属的 Open Graph 分享图。

生产环境需要注入 `AUDIO_SIGNING_SECRET`，不得将真实值写入代码或提交。开发变量示例见
`apps/web/.dev.vars.example`。R2 必须保持私有，Worker 只需要 Binding，不需要 S3 Access Key。

生产构建会将 `AUDIO_BUCKET` 绑定到现有 `xunxian-audio`，并默认设置
`AUDIO_ENABLED=true`，同时创建 `SIGN_RATE_LIMITER` 与 `AUDIO_RATE_LIMITER` Binding。首次部署前使用 Wrangler 登录 Cloudflare；部署后通过 Wrangler
交互式 Secret 命令写入 `AUDIO_SIGNING_SECRET`，不要把值放进命令参数、代码或聊天。
