#!/usr/bin/env bash
# Render Build Command:  pip install -r requirements.txt && bash build_pot.sh
# YouTube PO Token üreticisini (bgutil) proje klasörüne kurar. Render'da sadece proje klasörü
# build'den runtime'a taşındığı için HOME'a değil buraya klonluyoruz.
set -euo pipefail

VERSION="2.0.0"   # requirements.txt'teki bgutil-ytdlp-pot-provider sürümüyle aynı olmalı
TARGET="$(pwd)/bgutil-ytdlp-pot-provider"

rm -rf "$TARGET"
git clone --single-branch --branch "$VERSION" --depth 1 \
  https://github.com/Brainicism/bgutil-ytdlp-pot-provider.git "$TARGET"

cd "$TARGET/server"
npm ci
npx tsc
ls build/generate_once.js
echo "bgutil POT provider hazır: $TARGET/server"