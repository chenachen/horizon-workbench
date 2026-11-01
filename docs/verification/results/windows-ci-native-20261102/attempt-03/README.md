# Native Windows attempt 03 — bounded Job test exit confirmation

Run 41332498997/job 124925359174, commit e1035b6, compiled the native Windows main executable and sidecars and built both installers. Notices, installer collection, sidecar versions/Git JSON and the existing QuickJS healthy test succeeded. The Job test compiled and ran exactly once, then failed in 0.04s: Job-empty assertion succeeded, but the following immediate Child.try_wait was still None. Original job.log and final-jobs.json remain intact; no failure is relabeled as a pass. Later storage/Pi/main checks and automatic Publish were skipped.

The single proposed source change is under #[cfg(test)] only. Within the existing 3-second deadline, the loop waits for both Job empty and actual Child terminal. All original root/descendant membership, unrelated-process exclusion, Job empty, Child terminal and external-control-alive assertions remain. No production helper behavior, timeout duration, dependencies, workflow or lock changes. ProcessSol separately reviewed normal production wait paths and supplied its Drop/error-path boundary to Root; this candidate does not expand into those paths.

[Microsoft documents external TerminateProcess as asynchronous and says to wait on the process handle to confirm exit](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-terminateprocess). The observed accounting/Child timing supports this narrow test fix; native rerun remains required.

Only .work files were written. No local compile, GUI, service, appdata, source application, commit or push occurred. Root owns integration/push after review. Built installers remain in Actions artifact 13094530668 as an un-published fallback, with the unresolved-check limitation preserved.
