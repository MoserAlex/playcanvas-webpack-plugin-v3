#!/usr/bin/env sh
# merge current branch to master no-ff
branch=$(git symbolic-ref --short HEAD)
git checkout master
git pull origin master
git merge "${branch}" --no-ff -m "finish the ${branch} and merge into master"
