#!/usr/bin/env bash
# 公開しないものが、公開側に入っていないかを止める（2026-10-01）。
#
# なぜ要るか —— 開発の記録（判断・進捗・会話）を公開リポジトリへ載せていた。
# 人が気をつける方式では漏れたので、**機械で止める**。
#
# 見るもの（3 つ）:
#   1. 道   … 公開しない道（.claude/ など。下の PRIVATE_PATHS）が追跡されていないか
#   2. 印   … 追跡中のファイルの中身と commit メッセージに、会話の記録の印が無いか（下の MARKS）
#   3. 禁止語 … 社内の呼び名・個人名（大文字小文字は区別する。表記の揺れは一覧に並べる）。**一覧そのものは公開しない**。
#              手元の .private-deny-words（.gitignore 済み）から読む。CI では配らない（一覧を secret でも配らない方針）。
#              環境変数 OSS_DENY_WORDS があればそれを使う
#
# 使い方:
#   private-notes-check.sh [<commit>] [<range>]
#     <commit> … 中身を見る commit（既定 HEAD）
#     <range>  … メッセージを見る commit の範囲（例 origin/develop..HEAD）。省略すると見ない
#
# 見つけた中身はログへ出さない（CI のログは公開される）。出すのは file:line と規則名だけ。
set -uo pipefail

COMMIT="${1:-HEAD}"
RANGE="${2:-}"
SELF='.github/scripts/private-notes-check.sh'

# 公開しない道（.gitignore の「公開しないもの」と揃える）
PRIVATE_PATHS='^(\.claude/|CLAUDE\.md$|PRD\.md$|qa/|docs/(origin|handoff|specs|feedback|test-specs)/|\.private-deny-words$|test/(laps|quality-laps)\.test\.ts$|scripts/laps\.mjs$)'
# 会話の記録の印。発言者を名指す語が出たら、その周りは会話の書き写しになっている
MARKS='オーナー'

fail=0
say() { printf '%s\n' "$*" >&2; }

# 禁止語の一覧（1 行 1 語）
words="${OSS_DENY_WORDS:-}"
if [ -z "$words" ] && [ -f .private-deny-words ]; then
  words="$(grep -v '^#' .private-deny-words | sed '/^[[:space:]]*$/d')"
fi

# 1. 道
paths="$(git ls-tree -r --name-only "$COMMIT" | grep -E "$PRIVATE_PATHS" || true)"
if [ -n "$paths" ]; then
  say "NG [private-path] 公開しない道が追跡されている:"
  printf '%s\n' "$paths" | sed 's/^/  /' >&2
  fail=1
fi

# 2・3. 中身（自分自身は印の語を含むので除く）
scan() { # $1 = 規則名, $2 = 語
  local hits
  hits="$(git grep -I -n -F -e "$2" "$COMMIT" -- . ":(exclude)$SELF" 2>/dev/null | cut -d: -f2,3 || true)"
  if [ -n "$hits" ]; then
    say "NG [$1] 中身に見つかった（語は伏せる）:"
    printf '%s\n' "$hits" | head -20 | sed 's/^/  /' >&2
    fail=1
  fi
}
scan marker "$MARKS"
if [ -n "$words" ]; then
  n=0
  while IFS= read -r w; do
    [ -z "$w" ] && continue
    n=$((n + 1))
    scan "deny-word#$n" "$w"
  done <<< "$words"
else
  # CI では一覧を配らない方針なので黙って飛ばす。手元で一覧が無いときだけ知らせる
  [ -z "${GITHUB_ACTIONS:-}" ] && say "INFO 禁止語の一覧（.private-deny-words）が無いので、禁止語の検査は飛ばした"
fi

# commit メッセージ
if [ -n "$RANGE" ]; then
  # shellcheck disable=SC2086 # 範囲は「A..B」も「X --not --remotes」もあるので、語で割る
  msgs="$(git log --format='%H%n%B' $RANGE 2>/dev/null || true)"
  check_msg() { # $1 = 規則名, $2 = 語
    local found
    found="$(printf '%s\n' "$msgs" | awk -v w="$2" '/^[0-9a-f]{40}$/{c=$0; next} index($0, w){print substr(c,1,8)}' | sort -u)"
    if [ -n "$found" ]; then
      say "NG [$1] commit メッセージに見つかった: $(printf '%s ' $found)"
      fail=1
    fi
  }
  check_msg marker "$MARKS"
  if [ -n "$words" ]; then
    n=0
    while IFS= read -r w; do
      [ -z "$w" ] && continue
      n=$((n + 1))
      check_msg "deny-word#$n" "$w"
    done <<< "$words"
  fi
fi

if [ "$fail" -ne 0 ]; then
  say "止めました。公開しないものは .gitignore の道へ移し、会話は書き写さず、決めたことだけを要約で書く。"
  exit 1
fi
say "OK 公開しないものは見つかりませんでした"
