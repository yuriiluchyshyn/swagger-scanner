# GitHub Account Switching Protocol

## Overview
This document outlines the required protocol for switching GitHub accounts during development work to maintain proper commit attribution.

## Protocol Steps

### 1. Switch to Personal Account for Commits
Before making any commits, always switch to the personal GitHub account:
```bash
git config user.name "Yurii Luchyshyn"
git config user.email "yuriiluchyshyn@gmail.com"
```

### 2. Make Commits
Perform all necessary git operations (add, commit, push) while on the personal account.

### 3. Switch Back to Business Account
After completing all git operations, immediately switch back to the business account:
```bash
git config user.name "J2Y Luchyshyn"
git config user.email "j2yluchyshyn@consensus.la"
```

## Important Notes
- **Always** follow this protocol for every commit session
- The switch back to business account should happen **immediately** after pushing
- This ensures proper commit attribution while maintaining business account as default
- Never skip the switch-back step

## Verification
You can verify the current git configuration with:
```bash
git config user.name
git config user.email
```

## Automation
Consider creating git aliases for quick switching:
```bash
git config --global alias.personal '!git config user.name "Yurii Luchyshyn" && git config user.email "yuriiluchyshyn@gmail.com"'
git config --global alias.business '!git config user.name "J2Y Luchyshyn" && git config user.email "j2yluchyshyn@consensus.la"'
```

Then use:
- `git personal` - switch to personal account
- `git business` - switch to business account