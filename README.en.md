# OpenWrt LuCI feed

[简体中文](README.md) | **English**

This private source feed is used by the customized
[hnt510-great/openwrt](https://github.com/hnt510-great/openwrt) main tree.
The project targets x86_64/glibc, APK, native systemd and GNOME. Package
selection follows the main tree's saved configuration.

| Item | Value |
| --- | --- |
| Feed name | `luci` |
| Repository branch | `master` |
| Original upstream | [https://github.com/openwrt/luci](https://github.com/openwrt/luci) (`master`) |

Based on OpenWrt LuCI, this feed supplies the private main tree's Web
management interface, libraries, applications and translations. It preserves
local status-page, resource-cache, terminal and firewall interface changes.

## Main integrations

- **CPU status:** the overview shows available CPU temperature and mean
  frequency, with matching rpcd file ACLs. Rows are hidden without valid data.
- **Resource caching:** the LuCI resource version includes package database
  update time, so normal reloads pick up new views after package installation
  or upgrade instead of retaining an old version through Argon pages.
- **ttyd HTTPS:** the terminal view warns about mixed content and provides a
  separate-tab link. Certificate reuse and renewal hooks live in the
  `packages` feed's ttyd recipe.
- **Full cone NAT:** the firewall view adds the option and Chinese strings.
  Actual forwarding requires the main tree's kernel, nftables, libnftnl and
  firewall4 changes.
- **ucode ABI:** native modules and rebuild releases must follow the main
  tree's ABI rules during upgrades.

Passwall pages live in `passwall_luci`. The local daed, needrestart, Podman/QEMU
and journal application recipes live in `package/custom`. Argon is a separate
Git submodule rather than part of this repository.

## Get the source and build

Authenticate on the build machine with an account that can read every private
repository, then obtain the complete main tree:

```sh
gh auth login --hostname github.com --git-protocol https --web
gh auth setup-git
git clone https://github.com/hnt510-great/openwrt.git
cd openwrt
./scripts/feeds update -a
./scripts/feeds install -a
```

The main tree's `feeds.conf.default` already contains:

```text
src-git luci https://github.com/hnt510-great/openwrt-luci.git;master
```

To update only this feed in an existing main tree:

```sh
./scripts/feeds update luci
./scripts/feeds install -a -p luci
```

Select the desired package in the main configuration and run `make defconfig`.
Example individual package build:

```sh
make package/feeds/luci/luci-mod-status/compile V=s
```

Run these commands from the main-tree root. Preserve an existing `.config`;
see [local build](https://github.com/hnt510-great/openwrt/blob/main/docs/local-build.md) for setup in a new checkout.
`install` creates build-recipe links rather than installing software on a
device. The full `update -a` also checks and can modify main-tree custom recipes.

## Maintenance and validation

`origin` points to this private repository. To merge original upstream changes
in a new clone, add `upstream` once:

```sh
git -C feeds/luci remote add upstream https://github.com/openwrt/luci.git
git -C feeds/luci fetch upstream
git -C feeds/luci merge upstream/master
# Review, resolve conflicts and validate before pushing
git -C feeds/luci push origin master
```

Skip the add command if `upstream` already exists. `scripts/feeds update` pulls
the private branch; it does not merge original upstream automatically. Feed
integration and main-tree commits are separate. Preserve existing commits,
stashes and uncommitted work. Main-tree `patches/feeds/` files and feature
manifests are historical backups; do not reapply changes already present.

Changes to published APK contents require a new package version, preserving
immutable package identities. Record source checks, package builds, VM tests
and physical-device validation separately. This page summarizes existing
design and evidence without claiming new build or device results. See
[private GitHub hosting](https://github.com/hnt510-great/openwrt/blob/main/docs/github-source-hosting.md).

## Design and validation documents

- [CPU status and cache fixes](https://github.com/hnt510-great/openwrt/blob/main/docs/luci-cpu-status.md)
- [ttyd HTTPS](https://github.com/hnt510-great/openwrt/blob/main/docs/ttyd-https.md)
- [Full cone NAT](https://github.com/hnt510-great/openwrt/blob/main/docs/fullcone-nat.md)
- [ucode ABI upgrades](https://github.com/hnt510-great/openwrt/blob/main/docs/ucode-abi-repair.md)
- [Native supervision and LuCI interfaces](https://github.com/hnt510-great/openwrt/blob/main/docs/systemd-native-supervision.md)

## License and upstream

Retain upstream copyrights and licenses. Each package's source follows its
recipe's `PKG_LICENSE` and source declarations.
See the repository [LICENSE](LICENSE).
See [CONTRIBUTING.md](CONTRIBUTING.md) for general recipe conventions; project integration also follows the main-tree guidelines.
