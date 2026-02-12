---
allowed-tools: ["Bash", "Read"]
---

# Pre-Deploy Check

Run all checks needed before deployment.

1. Run `npm run lint` — must pass
2. Run `npm run test` — must pass
3. Run `npm run build` — must succeed
4. Check for uncommitted changes with `git status`
5. Report overall readiness: READY or NOT READY with reasons
