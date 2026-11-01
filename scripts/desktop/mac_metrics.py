#!/usr/bin/env python3
"""Read-only macOS process accounting; no GUI activation and no elevated privileges."""
from __future__ import annotations

import ctypes
import hashlib
import json
import math
import os
from pathlib import Path
import platform
import statistics
import subprocess
import time


def command(argv: list[str]) -> str:
    result = subprocess.run(argv, capture_output=True, text=True, timeout=15)
    return result.stdout.strip() if result.returncode == 0 else "unavailable"


def environment() -> dict:
    patch = subprocess.run(["git", "diff", "HEAD", "--binary"], capture_output=True).stdout
    return {"captured_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "os": command(["sw_vers"]), "architecture": platform.machine(),
            "hardware": command(["sysctl", "-n", "hw.model", "hw.memsize", "hw.ncpu", "machdep.cpu.brand_string"]),
            "git_version": command(["git", "--version"]), "revision": command(["git", "rev-parse", "HEAD"]),
            "tracked_patch_sha256": hashlib.sha256(patch).hexdigest(),
            "git_status": command(["git", "status", "--short"]), "python": platform.python_version()}


def percentile(values: list[float], fraction: float) -> float | None:
    """Nearest-rank percentile, including the 19th ordered value for n=20/P95."""
    if not values:
        return None
    return sorted(values)[max(0, math.ceil(len(values) * fraction) - 1)]


def stats(values: list[float]) -> dict:
    return {"count": len(values), "median": statistics.median(values) if values else None,
            "p95": percentile(values, .95), "max": max(values) if values else None,
            "mean": statistics.mean(values) if values else None}


class RUsage(ctypes.Structure):
    # RUSAGE_INFO_V2, from the installed macOS SDK sys/resource.h.
    _fields_ = [("uuid", ctypes.c_uint8 * 16)] + [(name, ctypes.c_uint64) for name in (
        "user_time", "system_time", "pkg_idle_wkups", "interrupt_wkups", "pageins", "wired_size",
        "resident_size", "phys_footprint", "proc_start_abstime", "proc_exit_abstime", "child_user_time",
        "child_system_time", "child_pkg_idle_wkups", "child_interrupt_wkups", "child_pageins",
        "child_elapsed_abstime", "diskio_bytesread", "diskio_byteswritten")]


class Timebase(ctypes.Structure):
    _fields_ = [("numer", ctypes.c_uint32), ("denom", ctypes.c_uint32)]


class MacMetrics:
    def __init__(self) -> None:
        if platform.system() != "Darwin":
            raise RuntimeError("This collector measures macOS only")
        self.lib = ctypes.CDLL("/usr/lib/libproc.dylib", use_errno=True)
        self.lib.proc_pid_rusage.argtypes = [ctypes.c_int, ctypes.c_int, ctypes.c_void_p]
        self.lib.proc_pid_rusage.restype = ctypes.c_int
        self.lib.proc_pidpath.argtypes = [ctypes.c_int, ctypes.c_void_p, ctypes.c_uint32]
        self.lib.proc_pidpath.restype = ctypes.c_int
        self.system = ctypes.CDLL("/usr/lib/libSystem.B.dylib", use_errno=True)
        self.timebase = Timebase()
        if self.system.mach_timebase_info(ctypes.byref(self.timebase)) != 0 or not self.timebase.denom:
            raise RuntimeError("Cannot read Mach timebase; CPU counter conversion unavailable")
        # Optional read-only SPI. Unavailable/failed attribution remains explicit in output.
        self.responsible = getattr(self.system, "responsibility_get_pid_responsible_for_pid", None)
        if self.responsible:
            self.responsible.argtypes = [ctypes.c_int]
            self.responsible.restype = ctypes.c_int
        self.previous: dict[tuple, tuple] = {}

    def processes(self) -> dict[int, dict]:
        text = command(["ps", "-axo", "pid=,ppid=,uid=,rss=,lstart=,comm="])
        processes = {}
        for line in text.splitlines():
            fields = line.split(None, 9)
            if len(fields) != 10:
                continue
            try:
                pid, ppid, uid, rss = map(int, fields[:4])
            except ValueError:
                continue
            processes[pid] = {"pid": pid, "ppid": ppid, "uid": uid, "rss_bytes": rss * 1024,
                              "start": " ".join(fields[4:9]), "executable": fields[9]}
        return processes

    def read(self, process: dict, now: float) -> dict:
        row = dict(process)
        row["executable"] = self.executable_path(row["pid"]) or row["executable"]
        usage = RUsage()
        if self.lib.proc_pid_rusage(row["pid"], 2, ctypes.byref(usage)) == 0:
            row.update(footprint_bytes=usage.phys_footprint, resident_bytes=usage.resident_size,
                       cpu_mach_ticks=usage.user_time + usage.system_time,
                       cpu_ns=(usage.user_time + usage.system_time) * self.timebase.numer // self.timebase.denom,
                       start_abstime=usage.proc_start_abstime,
                       disk_read_bytes=usage.diskio_bytesread, disk_write_bytes=usage.diskio_byteswritten)
            identity = (row["pid"], usage.proc_start_abstime)
            previous = self.previous.get(identity)
            row["cpu_percent_one_core"] = ((row["cpu_ns"] - previous[1]) / 1e9 / (now - previous[0]) * 100
                                           if previous and now > previous[0] else None)
            self.previous[identity] = (now, row["cpu_ns"])
        else:
            row.update(footprint_bytes=None, cpu_percent_one_core=None,
                       accounting_error=os.strerror(ctypes.get_errno()))
        return row

    def responsible_pid(self, pid: int) -> int | None:
        result = self.responsible(pid) if self.responsible else -1
        return result if result > 0 else None

    def executable_path(self, pid: int) -> str | None:
        buffer = ctypes.create_string_buffer(4096)
        return buffer.value.decode(errors="replace") if self.lib.proc_pidpath(pid, buffer, len(buffer)) > 0 else None


def select_processes(processes: dict, roots: set[int], members: dict, known: dict,
                     metrics: MacMetrics) -> tuple[dict, list]:
    selected = {}
    for pid, process in processes.items():
        if pid in roots:
            selected[pid] = {"group": "horizon", "reason": "root PID"}
        elif str(pid) in members:
            selected[pid] = dict(members[str(pid)])
        elif pid in known and known[pid]["start"] == process["start"]:
            selected[pid] = {"group": known[pid]["group"], "reason": "previously attributed; same process start"}
    changed = True
    while changed:
        changed = False
        for pid, process in processes.items():
            if pid not in selected and process["ppid"] in selected:
                selected[pid] = {"group": selected[process["ppid"]]["group"], "reason": f"child of {process['ppid']}"}
                changed = True
    unassigned = []
    for pid, process in processes.items():
        if pid in selected or process["uid"] != os.getuid():
            continue
        responsible = metrics.responsible_pid(pid)
        if responsible in selected:
            selected[pid] = {"group": selected[responsible]["group"],
                             "reason": f"macOS responsibility SPI → {responsible}"}
        elif "WebKit" in process["executable"]:
            unassigned.append({"pid": pid, "executable": process["executable"], "responsible_pid": responsible})
    for pid, attribution in selected.items():
        known[pid] = {**attribution, "start": processes[pid]["start"]}
    return selected, unassigned


def read_json(path: Path | None, fallback):
    return json.loads(path.read_text()) if path and path.exists() else fallback
