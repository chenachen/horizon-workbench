075ccd4 native Windows attempt13 — actual10-test CI success

Commit075ccd4685bd51a367bdf916d09c82926f0f9009
Run41364541063 / job125021798511
https://github.com/chenachen/horizon-workbench/actions/runs/41364541063
Release: https://github.com/chenachen/horizon-workbench/releases/tag/windows-075ccd4685bd

All10 named exact tests actually each passed1/0/0. The original9 remain; the one new
agent::tests::windows_managed_pi_activation_retry_boundaries passed1.75s against owned
real Windows directory locks and the production activation helper. Real managed Pi
install/detect/loopback chat/Job cleanup passed4.38s. ConPTY answered one actual CPR and
retained Chinese/Console120x40/Stop/actual exit/Jobempty assertions (0.52s). No cleanup
TIMEOUT or installation failure stage appeared. Exact names/results are in result.json.

The production Windows activation patch uses no-clobber MoveFileExW flags0, with a small
bounded wait only on OS5 while target is absent; other errors stay errors. This run and
controlled lock assertions do not identify who held the original3545 rename lock or
prove that this particular successful managed install used a retry. Attempt12 (8pass/
1fail at actual rename) and attempt09 remain unchanged; unknown holder is not called AV.

The unique main PID3216/start00:14:45.2760535Z was alive after5s with OS window80062,
Horizon/responding=true. The same process first exposed both valid Roaming registry
files at age6950.1642ms. That is a sampled first observation, not setup duration or2s
performance acceptance. The single read-only UIA helper exit0/button_not_observed
(elapsed2339ms); enabled Open local project button and frontend interaction remain
UNCONFIRMED. No repeat query or main launch was added; exact identity cleanup remains.

Five release assets were actually downloaded once into artifacts/windows/windows-
075ccd4685bd. Every actual file matched GitHub API size/digest, and both installers also
matched the published SHA256SUMS. download-verification.json is the receipt, with local
paths and full SHA. Binary bytes remain in ignored artifacts; the3 small raw assets are
preserved here. This trial is unsigned and does not claim full Windows GUI acceptance.

job.log preserves connector decoded UTF-8 BOM/ANSI/CRLF. Source hashes come from the
immutable commit, never the mutable working tree. No local compilation/test, GUI,
appdata/provider operation, CI rerun, workflow edit or commit/push occurred by this owner.
