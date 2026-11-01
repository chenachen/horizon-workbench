# Native Windows attempt06: test harness activation manifest

7395dc0/run41340169874/job124948287369 failed before Host test execution with0xc0000139 STATUS_ENTRYPOINT_NOT_FOUND. Native build/NSIS/MSI/sidecars/QuickJS1 actual test passed. Host test bodies0; ConPTY never began. Original job.log/final-jobs/result are preserved. Failure-only diagnostics succeeded and supplied the exact EXE, imports and OS build.

The28,672,630-byte artifact matches GitHub SHA15216c0f…. Its test EXE is12,429,312 bytes/SHAa630e1a6…, matching the native runner record. Dumpbin shows comctl32.dll importing TaskDialogIndirect. Read-only PE inspection shows resource RVA0/size0 and no.rsrc, so no embedded activation manifest. OS is Windows Server2022 Datacenter21H2 build20348.5761. Microsoft documents TaskDialogIndirect as Comctl32v6-only and default unmanifested common controls asv5. Locked Tauri's production default XML explicitly requests CommonControls6, while its resource compiler default links binaries, not this unit-test EXE. This establishes the harness activation gap; the next real run confirms the proposed fix.

The two-file test-manifest-fix/source.patch builds the same --lib test target once using --no-run, copies identical Tauri default XML as.exe.manifest, and then retains every original exact test command. Failure diagnostics preserve that external XML too. No dependencies, production resources, test logic, limits, tests or pass counts are changed. Nothing was run locally or applied to live source.

Primary references: https://learn.microsoft.com/en-us/windows/win32/api/commctrl/nf-commctrl-taskdialogindirect and https://learn.microsoft.com/en-us/windows/win32/controls/cookbook-overview .

This public archive preserves original text diagnostics, the two-file candidate and exact binary/artifact hashes. The12MB test EXE and28MB ZIP are retained in the referenced .work paths and native Actions artifact rather than duplicated into the source repository. Root explicitly allowed this docs-only publication during source freeze; live workflow/build.rs/scripts remain unchanged. Root owns candidate integration and the next push.
