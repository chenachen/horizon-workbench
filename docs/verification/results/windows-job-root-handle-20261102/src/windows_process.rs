//! Windows ownership for processes explicitly spawned by Horizon.
//! Spawn suspended, assign to a non-breakaway Job, then resume the owned thread.
use std::{
    io,
    mem::{size_of, zeroed},
    os::windows::{io::{AsRawHandle, FromRawHandle, OwnedHandle, RawHandle}, process::CommandExt},
    process::Command,
    sync::Arc,
};
use windows_sys::Win32::{
    Foundation::{DuplicateHandle, DUPLICATE_SAME_ACCESS, ERROR_INSUFFICIENT_BUFFER, HANDLE, INVALID_HANDLE_VALUE, WAIT_FAILED, WAIT_OBJECT_0, WAIT_TIMEOUT},
    NetworkManagement::IpHelper::{GetExtendedTcpTable, MIB_TCP6ROW_OWNER_PID, MIB_TCP6TABLE_OWNER_PID, MIB_TCPROW_OWNER_PID, MIB_TCPTABLE_OWNER_PID, TCP_TABLE_OWNER_PID_LISTENER},
    Networking::WinSock::{AF_INET, AF_INET6},
    System::{
        Diagnostics::ToolHelp::{CreateToolhelp32Snapshot, Thread32First, Thread32Next, THREADENTRY32, TH32CS_SNAPTHREAD},
        JobObjects::{AssignProcessToJobObject, CreateJobObjectW, IsProcessInJob, JobObjectBasicAccountingInformation, JobObjectExtendedLimitInformation, QueryInformationJobObject, SetInformationJobObject, TerminateJobObject, JOBOBJECT_BASIC_ACCOUNTING_INFORMATION, JOBOBJECT_EXTENDED_LIMIT_INFORMATION, JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE},
        Threading::{GetCurrentProcess, GetProcessId, GetProcessIdOfThread, OpenProcess, OpenThread, ResumeThread, TerminateProcess, WaitForSingleObject, CREATE_NEW_PROCESS_GROUP, CREATE_NO_WINDOW, CREATE_SUSPENDED, PROCESS_QUERY_LIMITED_INFORMATION, THREAD_QUERY_LIMITED_INFORMATION, THREAD_SUSPEND_RESUME},
    },
};

/// ConPTY uses these flags without CREATE_NO_WINDOW.
pub const SUSPENDED_CREATION_FLAGS: u32 = CREATE_SUSPENDED | CREATE_NEW_PROCESS_GROUP;

/// Only for pipe/noninteractive children. Apply after other creation flags.
pub fn prepare_command(command: &mut Command) {
    command.creation_flags(SUSPENDED_CREATION_FLAGS | CREATE_NO_WINDOW);
}

#[derive(Debug)]
pub struct OwnedJob {
    handle: OwnedHandle,
    root: OwnedHandle,
    root_pid: u32,
}

impl OwnedJob {
    fn create(process: HANDLE, root_pid: u32) -> io::Result<Arc<Self>> {
        let mut root = std::ptr::null_mut();
        let current = unsafe { GetCurrentProcess() };
        // Retain the same owned process object, without reopening by PID or
        // allowing this confirmation handle to escape into future children.
        if unsafe { DuplicateHandle(current, process, current, &mut root, 0, 0, DUPLICATE_SAME_ACCESS) } == 0 {
            return Err(io::Error::last_os_error());
        }
        let root = unsafe { OwnedHandle::from_raw_handle(root as RawHandle) };
        let handle = unsafe { CreateJobObjectW(std::ptr::null(), std::ptr::null()) };
        if handle.is_null() { return Err(io::Error::last_os_error()); }
        let handle = unsafe { OwnedHandle::from_raw_handle(handle as RawHandle) };
        let mut limits: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = unsafe { zeroed() };
        limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
        if unsafe { SetInformationJobObject(handle.as_raw_handle() as HANDLE, JobObjectExtendedLimitInformation, (&limits as *const JOBOBJECT_EXTENDED_LIMIT_INFORMATION).cast(), size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32) } == 0 {
            return Err(io::Error::last_os_error());
        }
        Ok(Arc::new(Self { handle, root, root_pid }))
    }

    pub fn root_pid(&self) -> u32 { self.root_pid }

    /// Targets only the processes associated with this owned Job handle.
    pub fn terminate(&self) -> io::Result<()> {
        if self.is_empty()? { return Ok(()); }
        if unsafe { TerminateJobObject(self.handle.as_raw_handle() as HANDLE, 1) } == 0 {
            return Err(io::Error::last_os_error());
        }
        Ok(())
    }

    /// Both the owned tree and the same root process must have terminated.
    /// Job accounting can reach zero before the root handle becomes signaled.
    pub fn is_empty(&self) -> io::Result<bool> {
        let mut accounting: JOBOBJECT_BASIC_ACCOUNTING_INFORMATION = unsafe { zeroed() };
        if unsafe { QueryInformationJobObject(self.handle.as_raw_handle() as HANDLE, JobObjectBasicAccountingInformation, (&mut accounting as *mut JOBOBJECT_BASIC_ACCOUNTING_INFORMATION).cast(), size_of::<JOBOBJECT_BASIC_ACCOUNTING_INFORMATION>() as u32, std::ptr::null_mut()) } == 0 {
            return Err(io::Error::last_os_error());
        }
        if accounting.ActiveProcesses != 0 { return Ok(false); }
        match unsafe { WaitForSingleObject(self.root.as_raw_handle() as HANDLE, 0) } {
            WAIT_OBJECT_0 => Ok(true),
            WAIT_TIMEOUT => Ok(false),
            WAIT_FAILED => Err(io::Error::last_os_error()),
            value => Err(io::Error::other(format!("unexpected owned root wait result: {value}"))),
        }
    }

    /// Read-only membership check, used for port ownership. No signal by PID.
    pub fn contains_pid(&self, pid: u32) -> io::Result<bool> {
        let process = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid) };
        if process.is_null() { return Err(io::Error::last_os_error()); }
        let process = unsafe { OwnedHandle::from_raw_handle(process as RawHandle) };
        let mut member = 0;
        if unsafe { IsProcessInJob(process.as_raw_handle() as HANDLE, self.handle.as_raw_handle() as HANDLE, &mut member) } == 0 {
            return Err(io::Error::last_os_error());
        }
        Ok(member != 0)
    }
}

fn resume_owned_thread(process: HANDLE, pid: u32) -> io::Result<()> {
    let snapshot = unsafe { CreateToolhelp32Snapshot(TH32CS_SNAPTHREAD, 0) };
    if snapshot == INVALID_HANDLE_VALUE { return Err(io::Error::last_os_error()); }
    let snapshot = unsafe { OwnedHandle::from_raw_handle(snapshot as RawHandle) };
    let mut entry: THREADENTRY32 = unsafe { zeroed() };
    entry.dwSize = size_of::<THREADENTRY32>() as u32;
    let mut found = unsafe { Thread32First(snapshot.as_raw_handle() as HANDLE, &mut entry) } != 0;
    while found {
        if entry.th32OwnerProcessID == pid {
            let thread = unsafe { OpenThread(THREAD_SUSPEND_RESUME | THREAD_QUERY_LIMITED_INFORMATION, 0, entry.th32ThreadID) };
            if thread.is_null() { return Err(io::Error::last_os_error()); }
            let thread = unsafe { OwnedHandle::from_raw_handle(thread as RawHandle) };
            // Check after opening the thread: a reused PID/thread ID cannot
            // authorize resuming another process after the owned child died.
            if unsafe { GetProcessIdOfThread(thread.as_raw_handle() as HANDLE) } != pid || unsafe { WaitForSingleObject(process, 0) } != WAIT_TIMEOUT {
                return Err(io::Error::new(io::ErrorKind::NotFound, "owned suspended process/thread no longer live"));
            }
            if unsafe { ResumeThread(thread.as_raw_handle() as HANDLE) } == u32::MAX {
                return Err(io::Error::last_os_error());
            }
            return Ok(());
        }
        found = unsafe { Thread32Next(snapshot.as_raw_handle() as HANDLE, &mut entry) } != 0;
    }
    Err(io::Error::new(io::ErrorKind::NotFound, "owned suspended primary thread not found"))
}

/// Attach a child created with SUSPENDED_CREATION_FLAGS, then let it run.
///
/// # Safety
/// `process` must be the live handle of the caller's newly spawned suspended
/// child, held throughout this call; `pid` must come from that same Child.
/// No ownership of the borrowed handle is taken; the Job retains a separate,
/// noninheritable duplicate for confirming this same root's terminal state.
/// A mismatched PID is rejected
/// without terminating anything. On subsequent failure this function requests
/// termination through the owned Job/child handle and waits at most two seconds.
/// The caller retains Child; cleanup timeout is an error, never proof of exit.
pub unsafe fn attach_suspended(process: RawHandle, pid: u32) -> io::Result<Arc<OwnedJob>> {
    let process = process as HANDLE;
    if process.is_null() || GetProcessId(process) != pid || pid == 0 {
        return Err(io::Error::new(io::ErrorKind::InvalidInput, "owned child handle/PID mismatch"));
    }
    if WaitForSingleObject(process, 0) != WAIT_TIMEOUT {
        return Err(io::Error::new(io::ErrorKind::NotFound, "owned child exited before Job assignment"));
    }
    let mut job = None;
    let result = (|| {
        let created = OwnedJob::create(process, pid)?;
        job = Some(created.clone());
        if AssignProcessToJobObject(created.handle.as_raw_handle() as HANDLE, process) == 0 {
            return Err(io::Error::last_os_error());
        }
        resume_owned_thread(process, pid)?;
        Ok(created)
    })();
    match result {
        Ok(job) => Ok(job),
        Err(error) => {
            if let Some(job) = &job { let _ = job.terminate(); }
            // This handle was validated above; do not reopen/kill by PID.
            if WaitForSingleObject(process, 0) != WAIT_OBJECT_0 { let _ = TerminateProcess(process, 1); }
            if WaitForSingleObject(process, 2000) != WAIT_OBJECT_0 {
                return Err(io::Error::new(io::ErrorKind::TimedOut, format!("{error}; owned spawn cleanup unconfirmed for PID {pid}")));
            }
            Err(error)
        }
    }
}

fn tcp_table(family: u32) -> io::Result<Vec<u8>> {
    let mut size = 0;
    let first = unsafe { GetExtendedTcpTable(std::ptr::null_mut(), &mut size, 0, family, TCP_TABLE_OWNER_PID_LISTENER, 0) };
    if first != 0 && first != ERROR_INSUFFICIENT_BUFFER { return Err(io::Error::from_raw_os_error(first as i32)); }
    for _ in 0..3 {
        let mut data = vec![0u8; size as usize];
        let status = unsafe { GetExtendedTcpTable(data.as_mut_ptr().cast(), &mut size, 0, family, TCP_TABLE_OWNER_PID_LISTENER, 0) };
        if status == 0 { data.truncate(size as usize); return Ok(data); }
        if status != ERROR_INSUFFICIENT_BUFFER { return Err(io::Error::from_raw_os_error(status as i32)); }
    }
    Err(io::Error::new(io::ErrorKind::WouldBlock, "TCP listener table changed while reading"))
}

/// Windows IPv4/IPv6 listener owners; callers must still check their Job.
pub fn tcp_listener_pids(port: u16) -> io::Result<Vec<u32>> {
    let mut owners = vec![];
    for family in [AF_INET, AF_INET6] {
        let data = tcp_table(family as u32)?;
        if data.len() < size_of::<u32>() { return Err(io::Error::new(io::ErrorKind::InvalidData, "short TCP table")); }
        let count = unsafe { std::ptr::read_unaligned(data.as_ptr().cast::<u32>()) } as usize;
        let (offset, row_size) = if family == AF_INET {
            (std::mem::offset_of!(MIB_TCPTABLE_OWNER_PID, table), size_of::<MIB_TCPROW_OWNER_PID>())
        } else {
            (std::mem::offset_of!(MIB_TCP6TABLE_OWNER_PID, table), size_of::<MIB_TCP6ROW_OWNER_PID>())
        };
        if count > data.len().saturating_sub(offset) / row_size { return Err(io::Error::new(io::ErrorKind::InvalidData, "truncated TCP listener rows")); }
        for index in 0..count {
            let ptr = unsafe { data.as_ptr().add(offset + index * row_size) };
            let (network_port, pid) = if family == AF_INET {
                let row = unsafe { std::ptr::read_unaligned(ptr.cast::<MIB_TCPROW_OWNER_PID>()) };
                (row.dwLocalPort, row.dwOwningPid)
            } else {
                let row = unsafe { std::ptr::read_unaligned(ptr.cast::<MIB_TCP6ROW_OWNER_PID>()) };
                (row.dwLocalPort, row.dwOwningPid)
            };
            if u16::from_be(network_port as u16) == port { owners.push(pid); }
        }
    }
    owners.sort_unstable(); owners.dedup();
    Ok(owners)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{fs, thread, time::{Duration, Instant, SystemTime, UNIX_EPOCH}};

    const FIXTURE: &str = "windows_process::tests::owned_job_child_fixture";
    fn fixture_command(role: &str) -> Command {
        let mut command = Command::new(std::env::current_exe().unwrap());
        command.args(["--exact", FIXTURE, "--ignored", "--nocapture"]).env("HORIZON_JOB_TEST_ROLE", role).creation_flags(CREATE_NO_WINDOW);
        command
    }
    struct ExternalChild(std::process::Child);
    impl Drop for ExternalChild {
        fn drop(&mut self) { let _ = self.0.kill(); let _ = self.0.wait(); }
    }

    #[test]
    #[ignore = "only spawned by owned_job_stops_descendants_and_preserves_external"]
    fn owned_job_child_fixture() {
        match std::env::var("HORIZON_JOB_TEST_ROLE").as_deref() {
            Ok("parent") => {
                let child = fixture_command("leaf").spawn().unwrap();
                fs::write(std::env::var_os("HORIZON_JOB_TEST_MARKER").unwrap(), child.id().to_string()).unwrap();
                loop { thread::sleep(Duration::from_secs(1)); }
            }
            Ok("leaf") => loop { thread::sleep(Duration::from_secs(1)); },
            _ => {}
        }
    }

    #[test]
    fn owned_job_stops_descendants_and_preserves_external() {
        let directory = std::env::temp_dir().join(format!("horizon-job-{}-{}", std::process::id(), SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos()));
        fs::create_dir(&directory).unwrap();
        let marker = directory.join("owned-leaf.pid");
        let mut external = ExternalChild(fixture_command("leaf").spawn().unwrap());
        let mut command = fixture_command("parent");
        command.env("HORIZON_JOB_TEST_MARKER", &marker);
        prepare_command(&mut command);
        let mut child = command.spawn().unwrap();
        let job = unsafe { attach_suspended(child.as_raw_handle(), child.id()) }.unwrap();
        let started = Instant::now();
        while !marker.is_file() && started.elapsed() < Duration::from_secs(5) { thread::sleep(Duration::from_millis(10)); }
        let descendant: u32 = fs::read_to_string(&marker).unwrap().parse().unwrap();
        assert!(job.contains_pid(child.id()).unwrap());
        assert!(job.contains_pid(descendant).unwrap());
        assert!(!job.contains_pid(external.0.id()).unwrap());
        job.terminate().unwrap();
        let stopped = Instant::now();
        while stopped.elapsed() < Duration::from_secs(3)
            && (!job.is_empty().unwrap() || child.try_wait().unwrap().is_none())
        {
            thread::sleep(Duration::from_millis(10));
        }
        assert!(job.is_empty().unwrap(), "owned Job must be empty, not only root exited");
        assert!(child.try_wait().unwrap().is_some());
        assert!(external.0.try_wait().unwrap().is_none(), "unrelated owned control must survive this Job termination");
        fs::remove_dir_all(&directory).unwrap();
    }
}
