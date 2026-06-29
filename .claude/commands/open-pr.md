# Create PR to Master

You are helping create a pull request from the current branch to `master`.

Follow these steps exactly, in order:

## 1. Gather context

Run these in parallel:
- `git status` — confirm branch is clean (warn if dirty)
- `git log master..HEAD --oneline` — all commits going into this PR
- `git diff master...HEAD` — full diff of what changed

## 2. Analyse the changes

From the diff and commit log, determine:
- **Type**: feat / fix / refactor / style / chore
- **What changed**: a single clear paragraph — what it does and why
- **Files touched**: group by area (UI, API, config, etc.)
- **Test checklist**: based on what actually changed — only include relevant items from `.github/pull_request_template.md`
- **Screenshots needed?**: yes if any `.vue` file changed

## 3. Draft the PR

Fill out `.github/pull_request_template.md` with real content — no placeholder text. Every section must be complete.

Title format (follow existing commit style):
```
type(scope): short description under 70 chars
```

## 4. Confirm before creating

Show the user:
- The PR title
- The filled-out body
- The base branch (`master`) and head branch

Ask: **"Create this PR?"** — wait for confirmation.

## 5. Create the PR

Once confirmed, run:
```bash
gh pr create --base master --title "..." --body "$(cat <<'EOF'
...filled template...
EOF
)"
```

Return the PR URL when done.

## Rules
- Never push with `--force`
- Never skip the confirmation step
- If the branch is not pushed to remote yet, push it first with `git push -u origin HEAD`
- If `gh` is not authenticated, tell the user to run `gh auth login` first
