a721 native Windows attempt09 — real install failure

Commit a721bfc517326238428aafc11efb1709673ed162; run 41352296478 / job 124984932027.
https://github.com/chenachen/horizon-workbench/actions/runs/41352296478

Native build produced and collected both installers; sidecar smoke succeeded.
Eight exact tests actually ran with 1 passed / 0 failed each: QuickJS, owned Job,
ConPTY, storage, NamedPipe, credential, fixed assets/ZIP/environment and corrupt archive.
ConPTY answered one actual CPR query, then asserted Chinese output, real Console
120x40, Stop, real process terminal and Job empty (0.41s; no cleanup TIMEOUT).

The ninth, real managed Pi chat smoke, ran 1 test and failed (0 passed / 1 failed,
2.81s). Its first failure was production install(...).await at agent.rs:628, returning
PERMISSION_DENIED / Access is denied. (os error 5). Provider startup and chat occur
later in the test and were not reached. Main five-second startup and Publish were
skipped by the existing failure gate; this attempt generated no release. The uploaded
installer artifact is metadata only here; no installer bytes were downloaded by this
agent. Root owns binary download/use decisions.

Exact IO site remains unknown in this raw log: install_from performs parent/staging
mkdir, ZIP output writes, staged --version probe, staging-directory rename and final
--version probe. Network failures map separately to NETWORK_ERROR. NamedPipe, Git,
provider and model work occur after installation. Do not infer a permission workaround,
antivirus cause or intermittent success. No retry or new CI was started by this owner.

Compared with the prior successful ae6 commit, agent.rs, agent_platform.rs,
windows_process.rs, Cargo files and workflow are byte-identical. Both raw logs identify
runner 2.338.2 / WinServer2022 10.0.20348 / image 20261025.346.1; VM region differs.
Only lib native-confirm and three frontend files changed within apps/scripts/packages/
.github. Source comparison and failure-source.txt bind this boundary to the commit.

job.log preserves the connector's decoded text encoded as UTF-8, including BOM, ANSI
and all 2329 CRLF. failure.log is a readable derived excerpt. Original failure is kept.
No local compilation, native app operation, GUI, model request, service, workflow edit,
commit/push or rerun occurred. Interactive Windows frontend and two-second end-to-end
startup budget are not accepted by these checks.

The separate .work install-context-candidate adds only cfg(all(test,windows)) stderr
at the six existing installation IO boundaries for the next necessary push. It keeps
the original error, assertions, timeout, permission rules and operation expressions.
It is a diagnostic candidate, not a demonstrated Windows fix. See its manifest.
