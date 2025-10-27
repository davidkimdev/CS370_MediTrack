#!/bin/bash
# A friendlier script for merging PRs.
# Squashes, commits, and pushes with a bit more flair.
# Usage: ./merge-pr-simple.sh <branch-name> "<commit message>" "[co-author-name]"

BRANCH_NAME=$1
COMMIT_MSG=$2
COAUTHOR_NAME=$3

if [ -z "$BRANCH_NAME" ] || [ -z "$COMMIT_MSG" ]; then
    echo "Usage: ./merge-pr-simple.sh <branch-name> \"<commit message>\" \"[co-author-name]\""
    echo "Come on, you gotta give me a branch and a commit message."
    echo "Example: ./merge-pr-simple.sh feature/new-login \"feat: Add shiny new login page\" \"Pair Programmer\""
    exit 1
fi

echo "📥 Fetching branch '$BRANCH_NAME'..."
git fetch origin $BRANCH_NAME

echo "🔄 Hopping over to main and getting the latest..."
git checkout main
git pull origin main

echo "🔀 Squashing and merging changes from '$BRANCH_NAME'..."
git merge --squash origin/$BRANCH_NAME

if [ $? -ne 0 ]; then
    echo "❌ Woah, merge conflict! Fix it up, then commit the changes yourself."
    exit 1
fi

echo "💾 Looks good. Crafting the commit..."
if [ -n "$COAUTHOR_NAME" ]; then
    # Note: For a fully compliant co-author format, use "Name <email@domain.com>"
    git commit -m "$COMMIT_MSG

Co-authored-by: $COAUTHOR_NAME"
else
    git commit -m "$COMMIT_MSG"
fi

echo "🚀 Shipping it! Pushing to main..."
git push origin main

echo ""
echo "✅ All set! The new code is on its way."
echo "📝 Just one last thing: head over to GitHub and close out that PR."
