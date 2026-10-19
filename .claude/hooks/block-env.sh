#!/usr/bin/env bash
# PreToolUse hook: deny Read/Grep/Bash calls that would read a .env file's contents.
# .env.example / .env.sample / .env.template are allowed -- they hold no secrets.

input=$(cat)
tool=$(jq -r '.tool_name' <<<"$input")

# a .env, .env.local, .env.production, ... not preceded by a word char (so process.env, dotenv don't match)
ENV_RE='(^|[^A-Za-z0-9_])\.env(\.[A-Za-z0-9_-]+)?($|[^A-Za-z0-9_.-])'
# also drops grep's --exclude=.env* -- naming .env there keeps it from being read
strip_allowed() { sed -E -e 's/\.env\.(example|sample|template)//g' -e "s/--exclude=['\"]?\.env[^[:space:]'\"]*['\"]?//g"; }

deny() {
  jq -n --arg reason "$1" '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: $reason}}'
  exit 0
}

case "$tool" in
  Read)
    target=$(jq -r '.tool_input.file_path // ""' <<<"$input" | strip_allowed)
    grep -qE "$ENV_RE" <<<"$target" && deny "Reading .env files is blocked in this project."
    ;;
  Grep)
    target=$(jq -r '[.tool_input.path // "", .tool_input.glob // ""] | join(" ")' <<<"$input" | strip_allowed)
    grep -qE "$ENV_RE" <<<"$target" && deny "Searching .env files is blocked in this project."
    ;;
  Bash)
    cmd=$(jq -r '.tool_input.command // ""' <<<"$input")
    grep -qE "$ENV_RE" <<<"$(strip_allowed <<<"$cmd")" &&
      deny "Bash commands that touch .env files are blocked in this project."
    # recursive grep doesn't skip dotfiles, so it would read .env without naming it
    if grep -qE '(^|[;&|[:space:]])grep[[:space:]]+([^|;&]*[[:space:]])?-[A-Za-z]*[rR]' <<<"$cmd" &&
      ! grep -qE -- "--exclude=['\"]?\.env" <<<"$cmd"; then
      deny "Recursive grep would read .env files; add --exclude='.env*' (or use rg, which skips dotfiles)."
    fi
    ;;
esac
exit 0
