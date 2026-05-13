#!/bin/bash
# GitHub 푸시 스크립트

# .env 파일에서 토큰 읽기
GITHUB_TOKEN=$(grep GITHUB_TOKEN .env | cut -d '=' -f2)

if [ -z "$GITHUB_TOKEN" ]; then
    echo "Error: GITHUB_TOKEN not found in .env file"
    exit 1
fi

# 현재 브랜치 가져오기
BRANCH=$(git branch --show-current)

echo "Pushing to branch: $BRANCH"
git push https://EmmettHwang:${GITHUB_TOKEN}@github.com/EmmettHwang/edenfood.git $BRANCH