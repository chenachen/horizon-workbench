4d27cfb native Windows attempt10 — actual success

Commit 4d27cfb22304f784bb811dce7365dfffbaf3b14d
Run 41354321875 / job 124991021303
https://github.com/chenachen/horizon-workbench/actions/runs/41354321875
Release: https://github.com/chenachen/horizon-workbench/releases/tag/windows-4d27cfb22304

All nine existing exact tests actually ran, each 1 passed / 0 failed / 0 ignored:
QuickJS, owned Job lifecycle, real ConPTY, storage, private NamedPipe, owned credential,
fixed runtime assets/ZIP/environment, corrupt archive rejection, and real managed Pi
install/detect/loopback chat/Job cleanup (4.40s). The final managed-chat test remains
explicitly ignored by default and was run with its original --exact --ignored filter.

ConPTY replied once to the real cursor query; the unchanged assertions then verified
Chinese output, Console120x40, Stop, actual process terminal and empty Job (0.53s).
No cleanup TIMEOUT appears. No new scene, retry or test rerun was started.

The compiled main EXE was observed alive after five seconds: PID7220, start identity
2026-11-01T22:11:31.2700065Z, OS window70050/title Horizon/responding=true. The runner
had WebView2 131.0.2903.86 and Session2. startup-smoke.json preserves the exact owned
PID/start cleanup and fresh appdata boundary. This is an OS window/process smoke;
interactive Windows frontend and the 2-second end-to-end startup budget are untested.

The commit-specific prerelease is published (draft=false, prerelease=true), with five
assets including both installers. All three small release assets were downloaded and
matched their GitHub-computed SHA256/size. Published SHA256SUMS matches both installer
asset digests. This owner did not download installer bytes; Root owns that independent
binary download. No old release assets were downloaded or re-reviewed.

The historical a721 install PERMISSION_DENIED remains unexplained. That failed run is
frozen independently at windows-ci-attempt09-pi-install-20261102. This attempt emitted
no installation failure-stage line. The only installation code change is cfg(test,
windows) stderr context, with original non-test operation expressions/errors intact.
This successful run does not demonstrate a permission fix or justify calling the old
failure intermittent. Actual current image is win22/20261026.347.1 (build-identity.txt);
image variation is recorded without assigning it as the failure cause.

Source identity is bound to the pushed commit, original CI log, published build identity
and source-freeze.json (hashes read from commit objects, not mutable working tree).
job.log preserves connector decoded UTF-8 bytes with BOM/ANSI/CRLF. final-jobs/release/
artifacts are structured API metadata. No local compilation, native GUI, local service,
commit/push/cancel or workflow edit occurred. During Mac final20 this owner fetched only
small remote status; raw processing/download/hash work began after Root reported
observer99803 exit0 and lifted that freeze.
