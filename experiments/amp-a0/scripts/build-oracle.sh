#!/bin/sh
# Só grava em target/amp-a0. Não modifica o Git principal nem baixa modelos.
set -eu
amp_root=$(CDPATH= cd -- "$(dirname -- "$0")/../../.." && pwd)
amp_core="$amp_root/target/amp-a0/NeuralAmpModelerCore"
amp_sha=0b3d3c97b0859a3a8c92a8628c4dd89a25eb5842
command -v cmake >/dev/null || { echo "CMake não está disponível." >&2; exit 1; }
if [ ! -d "$amp_core" ]; then
  git clone --depth 1 --branch v0.6.0 --recurse-submodules https://github.com/sdatkinson/NeuralAmpModelerCore.git "$amp_core"
fi
if [ "$(git -C "$amp_core" rev-parse HEAD)" != "$amp_sha" ]; then
  echo "A cópia do Core não é o commit fixado. Preserve-a e confira antes de continuar." >&2
  exit 1
fi
git -C "$amp_core" diff --quiet -- NAM Dependencies/nlohmann || {
  echo "O código local do Core foi alterado. Confira antes de usar como referência." >&2
  exit 1
}
for amp_dependency in eigen AudioDSPTools; do
  amp_expected=$(git -C "$amp_core" rev-parse "HEAD:Dependencies/$amp_dependency")
  amp_actual=$(git -C "$amp_core/Dependencies/$amp_dependency" rev-parse HEAD)
  if [ "$amp_actual" != "$amp_expected" ]; then
    echo "O submódulo $amp_dependency não está no commit fixado pelo Core." >&2
    exit 1
  fi
  git -C "$amp_core/Dependencies/$amp_dependency" diff --quiet || {
    echo "Há alterações locais no submódulo $amp_dependency." >&2
    exit 1
  }
done
cmake -S "$amp_root/experiments/amp-a0/oracle" -B "$amp_root/target/amp-a0/oracle-build" -DCMAKE_BUILD_TYPE=Release -DNAMCORE="$amp_core"
cmake --build "$amp_root/target/amp-a0/oracle-build" --parallel 4
