#!/bin/sh
printf '%s\n' "$$" > .git/horizon-slow-hook.pid
sleep 300 &
printf '%s\n' "$!" > .git/horizon-slow-child.pid
wait
