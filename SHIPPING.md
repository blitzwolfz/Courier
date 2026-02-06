# Shipping Courier

Guide to building, code signing, and distributing Courier for Windows, macOS, and Linux.

---

## Table of Contents

- [Production Build](#production-build)
- [Platform Targets](#platform-targets)
- [Code Signing](#code-signing)
  - [Windows](#windows-code-signing)
  - [macOS](#macos-code-signing)
  - [Linux](#linux-signing)
- [Tauri Bundle Configuration](#tauri-bundle-configuration)
- [Auto-Updater](#auto-updater)
- [CI/CD with GitHub Actions](#cicd-with-github-actions)
- [Release Checklist](#release-checklist)
- [Troubleshooting](#troubleshooting)

---

## Production Build

### Prerequisites

- Node.js >= 18
- Rust >= 1.93.0
- Platform-specific dependencies (see [SETUP.md](SETUP.md))

### Build Command

```
npm run tauri build
```

This runs `tsc && vite build` for the frontend, then compiles the Rust backend in release mode and packages platform-specific installers.

Output is placed in `src-tauri/target/release/bundle/`:

| Platform | Artifacts |
|----------|-----------|
| Windows | `Courier_0.1.0_x64-setup.exe` (NSIS), `Courier_0.1.0_x64_en-US.msi` (WiX) |
| macOS | `Courier.app`, `Courier_0.1.0_aarch64.dmg` |
| Linux | `courier_0.1.0_amd64.deb`, `courier-0.1.0-1.x86_64.rpm`, `courier_0.1.0_amd64.AppImage` |

### Debug Build

```
npm run tauri build -- --debug
```

Includes debug symbols and enables WebView developer tools. Useful for testing the bundled app without full optimization.

### Building for a Specific Target

```
npm run tauri build -- --target x86_64-pc-windows-msvc
npm run tauri build -- --target aarch64-apple-darwin
npm run tauri build -- --target x86_64-unknown-linux-gnu
```

### Cross-Compilation

Tauri does not support cross-compilation. Each platform must be built on its native OS. Use CI/CD (see below) to build for all three platforms.

---

## Platform Targets

### Windows

Courier ships two installer formats:

**NSIS (`*-setup.exe`)** -- Recommended for end users.
- Install/uninstall with GUI wizard
- Per-user or per-machine installation
- Start menu and desktop shortcuts
- Automatic uninstaller registration

**MSI (`*.msi`)** -- Recommended for enterprise/IT deployment.
- Silent installation: `msiexec /i Courier_0.1.0_x64_en-US.msi /quiet`
- Group Policy deployment support
- Windows Installer service integration

Configuration in `tauri.conf.json`:

```json
{
  "bundle": {
    "targets": ["nsis", "msi"],
    "windows": {
      "nsis": {
        "displayLanguageSelector": false,
        "installerIcon": "icons/icon.ico",
        "headerImage": "icons/icon.png"
      }
    }
  }
}
```

### macOS

**DMG** -- Standard disk image with drag-to-Applications workflow.

**App Bundle** -- `Courier.app` can be distributed directly or notarized and stapled.

The minimum macOS version defaults to 10.13 (High Sierra). To target a higher version:

```json
{
  "bundle": {
    "macOS": {
      "minimumSystemVersion": "11.0"
    }
  }
}
```

### Linux

**deb** -- For Debian, Ubuntu, and derivatives.
```
sudo dpkg -i courier_0.1.0_amd64.deb
```

**rpm** -- For Fedora, RHEL, openSUSE.
```
sudo rpm -i courier-0.1.0-1.x86_64.rpm
```

**AppImage** -- Portable, no installation required.
```
chmod +x courier_0.1.0_amd64.AppImage
./courier_0.1.0_amd64.AppImage
```

---

## Code Signing

### Windows Code Signing

Windows code signing eliminates SmartScreen warnings and establishes publisher trust.

#### Certificate Types

| Type | Cost | SmartScreen | Notes |
|------|------|-------------|-------|
| EV (Extended Validation) | ~$300-500/year | Immediate trust | Hardware token required, best for production |
| OV (Organization Validation) | ~$100-200/year | Reputation builds over time | Software-based, good for small teams |
| Self-signed | Free | No trust | Development/testing only |

#### Signing with SignTool

1. Obtain a code signing certificate from a CA (DigiCert, Sectigo, GlobalSign).

2. Set environment variables before building:

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY = "path/to/certificate.pfx"
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "certificate-password"
```

3. For EV certificates on a hardware token (USB):

```powershell
# SignTool is included with Windows SDK
signtool sign /sha1 <THUMBPRINT> /tr http://timestamp.digicert.com /td sha256 /fd sha256 "src-tauri\target\release\bundle\nsis\Courier_0.1.0_x64-setup.exe"
```

4. For PFX-based certificates:

```powershell
signtool sign /f certificate.pfx /p <PASSWORD> /tr http://timestamp.digicert.com /td sha256 /fd sha256 "src-tauri\target\release\bundle\nsis\Courier_0.1.0_x64-setup.exe"
```

5. Sign both the NSIS installer and the MSI:

```powershell
signtool sign /f certificate.pfx /p <PASSWORD> /tr http://timestamp.digicert.com /td sha256 /fd sha256 "src-tauri\target\release\bundle\msi\Courier_0.1.0_x64_en-US.msi"
```

#### Tauri NSIS Built-in Signing

Tauri can sign the NSIS installer automatically during build. Add to `tauri.conf.json`:

```json
{
  "bundle": {
    "windows": {
      "signCommand": "signtool sign /sha1 <THUMBPRINT> /tr http://timestamp.digicert.com /td sha256 /fd sha256 %1"
    }
  }
}
```

The `%1` placeholder is replaced with the file path during build.

#### SmartScreen Notes

- EV certificates provide immediate SmartScreen trust.
- OV certificates require reputation building (downloads over time).
- Unsigned apps trigger "Windows protected your PC" warnings.
- Timestamping (`/tr`) ensures signatures remain valid after certificate expiry.

### macOS Code Signing

macOS code signing and notarization are required for distribution outside the App Store. Without them, Gatekeeper blocks the app.

#### Prerequisites

1. **Apple Developer Account** ($99/year): https://developer.apple.com
2. **Developer ID Application certificate**: Certificates, Identifiers & Profiles > Create Certificate > Developer ID Application
3. **Xcode Command Line Tools**: `xcode-select --install`

#### Environment Variables

Set these before running `npm run tauri build`:

```bash
# Certificate identity (from Keychain Access > My Certificates)
export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAM_ID)"

# Apple ID credentials for notarization
export APPLE_ID="your@apple.id"
export APPLE_PASSWORD="app-specific-password"
export APPLE_TEAM_ID="YOUR_TEAM_ID"
```

Generate an app-specific password at https://appleid.apple.com/account/manage > Sign-In and Security > App-Specific Passwords.

#### Tauri Configuration

Add to `tauri.conf.json`:

```json
{
  "bundle": {
    "macOS": {
      "signingIdentity": "Developer ID Application: Your Name (TEAM_ID)",
      "entitlements": "Entitlements.plist"
    }
  }
}
```

#### Entitlements

Create `src-tauri/Entitlements.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.cs.allow-dyld-environment-variables</key>
    <true/>
    <key>com.apple.security.network.client</key>
    <true/>
</dict>
</plist>
```

The `allow-jit` and `allow-unsigned-executable-memory` entitlements are required because Courier's WebView executes JavaScript.

#### Manual Signing and Notarization

If Tauri's built-in signing is insufficient (e.g., custom workflows):

```bash
# 1. Sign the app bundle
codesign --deep --force --verify --verbose \
  --sign "Developer ID Application: Your Name (TEAM_ID)" \
  --options runtime \
  --entitlements src-tauri/Entitlements.plist \
  "src-tauri/target/release/bundle/macos/Courier.app"

# 2. Create a ZIP for notarization
ditto -c -k --keepParent \
  "src-tauri/target/release/bundle/macos/Courier.app" \
  Courier.zip

# 3. Submit for notarization
xcrun notarytool submit Courier.zip \
  --apple-id "$APPLE_ID" \
  --password "$APPLE_PASSWORD" \
  --team-id "$APPLE_TEAM_ID" \
  --wait

# 4. Staple the notarization ticket to the app
xcrun stapler staple "src-tauri/target/release/bundle/macos/Courier.app"

# 5. Also staple to the DMG
xcrun stapler staple "src-tauri/target/release/bundle/dmg/Courier_0.1.0_aarch64.dmg"
```

#### Verification

```bash
# Verify code signature
codesign --verify --deep --strict --verbose=4 "Courier.app"

# Check notarization status
spctl --assess --type execute --verbose "Courier.app"

# Check Gatekeeper acceptance
xattr -d com.apple.quarantine "Courier.app"  # Remove quarantine attr for testing
```

### Linux Signing

Linux does not have a mandatory code signing requirement like Windows and macOS. However, package signing is recommended for repository distribution.

#### GPG Signing for deb Packages

```bash
# Generate a GPG key (if you don't have one)
gpg --full-generate-key

# Sign the deb package
dpkg-sig --sign builder courier_0.1.0_amd64.deb

# Verify
dpkg-sig --verify courier_0.1.0_amd64.deb
```

#### RPM Signing

```bash
# Configure RPM macros
echo "%_gpg_name Your Name <your@email.com>" >> ~/.rpmmacros

# Sign the RPM
rpm --addsign courier-0.1.0-1.x86_64.rpm

# Verify
rpm --checksig courier-0.1.0-1.x86_64.rpm
```

#### AppImage

AppImages can include an embedded GPG signature:

```bash
# Sign with appimagetool
appimagetool --sign courier.AppDir courier_0.1.0_amd64.AppImage
```

---

## Tauri Bundle Configuration

The full bundle configuration in `tauri.conf.json`:

```json
{
  "productName": "Courier",
  "version": "0.1.0",
  "identifier": "com.courier",
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "category": "DeveloperTool",
    "shortDescription": "Local-first API development platform",
    "longDescription": "Courier is a native alternative to Postman, built with Tauri v2 and React 19. HTTP, WebSocket, gRPC, GraphQL, code generation, scripting, and more. All data stays on your machine.",
    "copyright": "Copyright 2025 Courier contributors",
    "license": "MIT",
    "licenseFile": "../LICENSE",
    "resources": [],
    "windows": {
      "signCommand": "",
      "nsis": {
        "displayLanguageSelector": false,
        "installerIcon": "icons/icon.ico"
      }
    },
    "macOS": {
      "minimumSystemVersion": "10.13",
      "signingIdentity": null,
      "entitlements": null
    },
    "linux": {
      "deb": {
        "depends": ["libwebkit2gtk-4.1-0", "libssl3"],
        "section": "devel"
      },
      "rpm": {
        "release": "1"
      },
      "appimage": {
        "bundleMediaFramework": false
      }
    }
  }
}
```

### Key Fields

| Field | Purpose |
|-------|---------|
| `identifier` | Reverse-domain identifier (`com.courier`). Used for data directory paths and OS integration. |
| `targets` | `"all"` builds every format. Alternatives: `["nsis", "msi"]`, `["dmg"]`, `["deb", "appimage"]` |
| `category` | macOS app category. Options: `DeveloperTool`, `Productivity`, `Utility`, etc. |
| `icon` | Array of icon paths. Tauri selects the appropriate one per platform. |
| `resources` | Extra files to bundle alongside the binary. |

---

## Auto-Updater

Tauri v2 includes a built-in updater plugin for distributing updates to users.

### 1. Generate Update Signing Keys

```bash
npx @tauri-apps/cli signer generate -w ~/.tauri/courier.key
```

This creates:
- `~/.tauri/courier.key` -- Private key (keep secret)
- `~/.tauri/courier.key.pub` -- Public key (embed in app)

### 2. Configure the Updater

Add to `src-tauri/Cargo.toml`:

```toml
[dependencies]
tauri-plugin-updater = "2"
```

Add to `tauri.conf.json`:

```json
{
  "plugins": {
    "updater": {
      "pubkey": "CONTENTS_OF_YOUR_PUBLIC_KEY",
      "endpoints": [
        "https://releases.example.com/courier/{{target}}/{{arch}}/{{current_version}}"
      ],
      "windows": {
        "installMode": "passive"
      }
    }
  }
}
```

Add to `src-tauri/capabilities/default.json`:

```json
{
  "permissions": [
    "core:default",
    "opener:default",
    "updater:default"
  ]
}
```

### 3. Build with Signing

```bash
export TAURI_SIGNING_PRIVATE_KEY=$(cat ~/.tauri/courier.key)
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
npm run tauri build
```

This produces signed update bundles alongside the regular installers.

### 4. Update Server

The update endpoint must return JSON in this format:

```json
{
  "version": "0.2.0",
  "notes": "Bug fixes and performance improvements",
  "pub_date": "2025-12-01T00:00:00Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "SIGNATURE_CONTENTS",
      "url": "https://releases.example.com/courier/Courier_0.2.0_x64-setup.nsis.zip"
    },
    "darwin-aarch64": {
      "signature": "SIGNATURE_CONTENTS",
      "url": "https://releases.example.com/courier/Courier.app.tar.gz"
    },
    "linux-x86_64": {
      "signature": "SIGNATURE_CONTENTS",
      "url": "https://releases.example.com/courier/courier_0.2.0_amd64.AppImage.tar.gz"
    }
  }
}
```

### GitHub Releases as Update Server

Use the `tauri-action` GitHub Action (see CI/CD section) to automatically publish releases. Set the endpoint to:

```
https://github.com/YOUR_ORG/courier/releases/latest/download/latest.json
```

The action generates `latest.json` automatically.

---

## CI/CD with GitHub Actions

### Workflow: Build and Release

Create `.github/workflows/release.yml`:

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    strategy:
      fail-fast: false
      matrix:
        include:
          - platform: windows-latest
            target: x86_64-pc-windows-msvc
          - platform: macos-latest
            target: aarch64-apple-darwin
          - platform: macos-latest
            target: x86_64-apple-darwin
          - platform: ubuntu-22.04
            target: x86_64-unknown-linux-gnu

    runs-on: ${{ matrix.platform }}

    steps:
      - uses: actions/checkout@v4

      - name: Install Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install Rust
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.target }}

      - name: Install Linux dependencies
        if: matrix.platform == 'ubuntu-22.04'
        run: |
          sudo apt update
          sudo apt install -y libwebkit2gtk-4.1-dev build-essential curl wget file \
            libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev

      - name: Install frontend dependencies
        run: npm ci

      - name: Build Tauri app
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          # Windows signing
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
          # macOS signing
          APPLE_SIGNING_IDENTITY: ${{ secrets.APPLE_SIGNING_IDENTITY }}
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_PASSWORD: ${{ secrets.APPLE_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
          APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
          APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
        with:
          tagName: v__VERSION__
          releaseName: Courier v__VERSION__
          releaseBody: 'See the [changelog](CHANGELOG.md) for details.'
          releaseDraft: true
          prerelease: false
          args: --target ${{ matrix.target }}
```

### Required GitHub Secrets

| Secret | Platform | Description |
|--------|----------|-------------|
| `TAURI_SIGNING_PRIVATE_KEY` | All | Tauri updater private key (from `signer generate`) |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | All | Password for the updater key |
| `APPLE_SIGNING_IDENTITY` | macOS | Developer ID certificate identity string |
| `APPLE_CERTIFICATE` | macOS | Base64-encoded .p12 certificate |
| `APPLE_CERTIFICATE_PASSWORD` | macOS | Password for the .p12 certificate |
| `APPLE_ID` | macOS | Apple ID email for notarization |
| `APPLE_PASSWORD` | macOS | App-specific password for notarization |
| `APPLE_TEAM_ID` | macOS | Apple Developer Team ID |

### Encoding the macOS Certificate

```bash
base64 -i certificate.p12 -o certificate-base64.txt
# Copy contents of certificate-base64.txt into APPLE_CERTIFICATE secret
```

### Triggering a Release

```bash
# Update version in tauri.conf.json and Cargo.toml, then:
git tag v0.1.0
git push origin v0.1.0
```

The workflow builds for all platforms, creates a draft GitHub Release, and uploads all installers as release assets.

---

## Release Checklist

Before each release:

1. **Version bump**
   - [ ] Update `version` in `src-tauri/tauri.conf.json`
   - [ ] Update `version` in `src-tauri/Cargo.toml`
   - [ ] Update `version` in `package.json`

2. **Build verification**
   - [ ] `npx tsc --noEmit` passes with no errors
   - [ ] `npx vite build` succeeds
   - [ ] `cargo check` in `src-tauri/` has zero warnings
   - [ ] `npm run tauri build` completes on target platform

3. **Testing**
   - [ ] App launches and displays correctly
   - [ ] HTTP requests work (GET, POST, PUT, DELETE)
   - [ ] WebSocket connections work
   - [ ] gRPC calls work with a test proto file
   - [ ] Collections CRUD works (create, rename, delete, drag-and-drop)
   - [ ] Import/export Postman collections
   - [ ] Environment variables interpolate correctly
   - [ ] Dark mode toggles correctly
   - [ ] All keyboard shortcuts function
   - [ ] Settings persist across restarts

4. **Signing**
   - [ ] Windows: NSIS and MSI are signed
   - [ ] macOS: App bundle is signed and notarized
   - [ ] Verify signatures on each platform

5. **Distribution**
   - [ ] Create git tag: `git tag v0.X.0`
   - [ ] Push tag: `git push origin v0.X.0`
   - [ ] CI/CD builds and uploads artifacts
   - [ ] Review draft release on GitHub
   - [ ] Publish release

---

## Troubleshooting

### Windows

**"Windows protected your PC" SmartScreen warning**
The binary is unsigned. Sign with an EV or OV certificate. EV certificates bypass SmartScreen immediately. OV certificates require reputation accumulation.

**MSI installation fails silently**
Run with logging: `msiexec /i Courier.msi /l*v install.log` and check `install.log`.

**SignTool not found**
Install Windows SDK or Visual Studio Build Tools. SignTool is at:
`C:\Program Files (x86)\Windows Kits\10\bin\10.0.xxxxx.0\x64\signtool.exe`

### macOS

**"Courier is damaged and can't be opened"**
The app was not notarized. Follow the notarization steps above, or remove the quarantine attribute for local testing:
```bash
xattr -cr /Applications/Courier.app
```

**"Developer cannot be verified"**
The app is signed but not notarized. Submit for notarization with `notarytool`.

**Notarization fails with "The signature of the binary is invalid"**
Ensure the `--options runtime` flag is passed to `codesign`. The hardened runtime is required for notarization.

**"The binary is not signed with a valid Developer ID certificate"**
Verify your signing identity:
```bash
security find-identity -p codesigning -v
```

### Linux

**AppImage fails to launch**
Ensure FUSE is installed: `sudo apt install fuse libfuse2`

**Missing WebKit dependency**
Install: `sudo apt install libwebkit2gtk-4.1-0`

### General

**Build fails with "identifier must not end with .app"**
The identifier `com.courier.app` conflicts with macOS bundle conventions. Use `com.courier` instead (already configured in this project).

**Cargo build takes too long in CI**
Add Rust caching to the GitHub Actions workflow:
```yaml
- uses: Swatinem/rust-cache@v2
  with:
    workspaces: src-tauri
```

**Frontend assets not found in release build**
Verify `frontendDist` in `tauri.conf.json` points to `../dist` and that `beforeBuildCommand` runs `npm run build`.
