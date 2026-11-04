# OpenWrt LuCI feed

本仓库是 [hnt510-great/openwrt](https://github.com/hnt510-great/openwrt) 定制主树使用的私有源码 feed。
项目面向 x86_64/glibc、APK、原生 systemd 和 GNOME 桌面；软件选择以主树
保存的完整配置为准。

| 项目 | 值 |
| --- | --- |
| Feed 名称 | `luci` |
| 本仓库分支 | `master` |
| 原始上游 | [https://github.com/openwrt/luci](https://github.com/openwrt/luci)（`master`） |

本 feed 基于 OpenWrt LuCI，为定制主树提供 Web 管理界面、基础库、应用及
翻译。它保留本项目的状态页、资源缓存、终端和防火墙界面修改。

## 本项目的主要集成

- **CPU 状态**：概览页显示可用的 CPU 温度和平均频率，配套 rpcd 文件访问
  ACL；没有有效传感器值时不显示对应行。
- **资源缓存**：LuCI 资源版本结合包数据库更新时间，安装或升级包后正常刷新
  即可获取新视图，避免 Argon 页面沿用过期资源版本。
- **ttyd HTTPS**：终端页面提示混合内容问题并提供新标签页入口；TLS 证书复用
  与续期重载逻辑位于 `packages` feed 的 ttyd 配方。
- **Full cone NAT**：防火墙页面增加对应选项和中文翻译；实际转发能力还依赖
  主树的内核、nftables、libnftnl 与 firewall4 修改。
- **ucode ABI**：原生模块及其重建版本需要配合主树 ABI 规则一起升级。

Passwall 页面位于独立的 `passwall_luci` feed；`luci-app-daed`、needrestart、
Podman/QEMU 管理及 journal 等本地应用配方位于主树 `package/custom`。
Argon 主题是另一个 Git 子模块，不属于本仓库。

## 获取与构建

先在构建机登录有权访问全部私有仓库的 GitHub 账号，再获取完整主树：

```sh
gh auth login --hostname github.com --git-protocol https --web
gh auth setup-git
git clone https://github.com/hnt510-great/openwrt.git
cd openwrt
./scripts/feeds update -a
./scripts/feeds install -a
```

主树 `feeds.conf.default` 已包含：

```text
src-git luci https://github.com/hnt510-great/openwrt-luci.git;master
```

在现有主树中只更新本 feed，可执行：

```sh
./scripts/feeds update luci
./scripts/feeds install -a -p luci
```

先在主树配置中选择所需包并运行 `make defconfig`。单包构建示例：

```sh
make package/feeds/luci/luci-mod-status/compile V=s
```

以上命令均从主树根目录运行。保留已有 `.config`；新 checkout 的配置恢复
步骤见 [本地构建指南](https://github.com/hnt510-great/openwrt/blob/main/docs/local-build.md)。`install` 安装的是构建配方链接，
不会在设备上安装软件。完整 `update -a` 还会检查并可能修改主树的 custom 配方。

## 维护与验证

`origin` 指向本私有仓库。新 clone 需要合并原始上游时，先添加一次 `upstream`：

```sh
git -C feeds/luci remote add upstream https://github.com/openwrt/luci.git
git -C feeds/luci fetch upstream
git -C feeds/luci merge upstream/master
# 审阅、解决冲突并完成相关验证后推送
git -C feeds/luci push origin master
```

已有 `upstream` 时跳过添加命令。`scripts/feeds update` 拉取本私有分支，
不会自动合并原始上游。本地集成修改与主树的提交分别管理，保留现有提交、
stash 和未提交文件。主树的 `patches/feeds/` 和功能清单是历史备份，
不要向已经包含修改的 feed 重复应用补丁。

涉及已发布 APK 内容的修改必须产生新包版本，不能覆盖同一包身份。源码
检查、包构建、VM 与物理设备验证应分别记录；本文汇总已有设计和验证记录，
不新增构建或设备验证结论。私有源码托管说明见
[GitHub 源码托管](https://github.com/hnt510-great/openwrt/blob/main/docs/github-source-hosting.md)。

## 设计与验证文档

- [CPU 温度、频率与缓存修复](https://github.com/hnt510-great/openwrt/blob/main/docs/luci-cpu-status.md)
- [ttyd HTTPS](https://github.com/hnt510-great/openwrt/blob/main/docs/ttyd-https.md)
- [Full cone NAT](https://github.com/hnt510-great/openwrt/blob/main/docs/fullcone-nat.md)
- [ucode ABI 升级](https://github.com/hnt510-great/openwrt/blob/main/docs/ucode-abi-repair.md)
- [原生服务监督与 LuCI 接口](https://github.com/hnt510-great/openwrt/blob/main/docs/systemd-native-supervision.md)

## 许可与上游

保留上游版权和许可。各软件包源码的许可按其配方 `PKG_LICENSE` 及源码声明执行。
仓库许可声明见 [LICENSE](LICENSE)。
通用配方约定见 [CONTRIBUTING.md](CONTRIBUTING.md)；本项目集成还需遵循主树规范。
