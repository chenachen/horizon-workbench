#!/bin/sh
printf '%s\n' "$$" > .git/horizon-slow-hook.pid
sleep 90 &
printf '%s\n' "$!" > .git/horizon-slow-child.pid
wait
