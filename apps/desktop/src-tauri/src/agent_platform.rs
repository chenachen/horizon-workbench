//! Private platform details for the fixed Pi runtime and its local broker.
use std::{fs, io, path::{Component, Path, PathBuf}, process::Command};

/// Pinned official v1.4.0 assets. Unknown platforms must never receive a Darwin fallback.
pub(super) fn asset_for(os: &str, arch: &str) -> Option<(&'static str, &'static str, u64)> {
    Some(match (os, arch) {
        ("windows", "x86_64") => ("pi-windows-x64.zip", "0f7256ea8bdac3af20012b94fdc1252a31cc6dc0d2f9b9eb539555d22e3e321b", 45_136_547),
        ("windows", "aarch64") => ("pi-windows-arm64.zip", "17ab17ee0e9088545c7dfa56d29490c45bd915425610b0db0cd937632f2df714", 43_770_747),
        ("macos", "aarch64") => ("pi-darwin-arm64.tar.gz", "79d9979d76a2a5adb7c28e27e9b44629928ccd0dc9fbb6ae7217860bd5e8be5d", 31_098_931),
        ("macos", "x86_64") => ("pi-darwin-x64.tar.gz", "1bdefc9e1074c1de458ea9f2e43e6013ce49cd05326009b3de144037036585e2", 33_558_360),
        ("linux", "aarch64") => ("pi-linux-arm64.tar.gz", "fa5829c7ef83ffeaebba015715c8306220f89b2aa8a00154efbba98dd5440156", 42_745_801),
        ("linux", "x86_64") => ("pi-linux-x64.tar.gz", "f2e4e4329603223d03260cdb8bd5033dbdc1f73ba58ab8939db2e56546e115d2", 42_645_744),
        _ => return None,
    })
}

pub(super) fn runtime_folder(os: &str, arch: &str) -> Option<&'static str> {
    match (os, arch) {
        ("windows", "aarch64") => Some("windows-arm64"),
        ("windows", "x86_64") => Some("windows-x64"),
        ("macos", "aarch64") => Some("darwin-arm64"),
        ("macos", "x86_64") => Some("darwin-x64"),
        ("linux", "aarch64") => Some("linux-arm64"),
        ("linux", "x86_64") => Some("linux-x64"),
        _ => None,
    }
}

pub(super) fn runtime_directory(data: &Path) -> PathBuf {
    data.join("runtimes/pi/1.4.0").join(runtime_folder(std::env::consts::OS, std::env::consts::ARCH).unwrap_or("unsupported"))
}

pub(super) fn runtime_relative_executable() -> &'static str {
    if cfg!(windows) { "pi.exe" } else { "pi/pi" }
}

pub(super) fn git_program() -> &'static str { if cfg!(windows) { "git.exe" } else { "/usr/bin/git" } }
pub(super) fn git_command() -> Command {
    #[allow(unused_mut)] let mut command=Command::new(git_program());
    #[cfg(windows)] {use std::os::windows::process::CommandExt;command.creation_flags(windows_sys::Win32::System::Threading::CREATE_NO_WINDOW);}
    command
}
pub(super) fn hooks_disabled() -> &'static str { if cfg!(windows) { "core.hooksPath=NUL" } else { "core.hooksPath=/dev/null" } }

/// Never inherit model keys, broker tokens, or arbitrary parent environment.
pub(super) fn environment(command: &mut Command, agent: bool) {
    command.env_clear();
    if cfg!(windows) {
        for key in ["PATH", "SystemRoot", "WINDIR", "ComSpec", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "TEMP", "TMP", "PATHEXT", "LANG", "LC_ALL", "SSL_CERT_FILE", "SSL_CERT_DIR"] {
            if let Some(value) = std::env::var_os(key) { command.env(key, value); }
        }
    } else if agent {
        for key in ["HOME", "TMPDIR", "LANG", "LC_ALL", "SSL_CERT_FILE", "SSL_CERT_DIR"] {
            if let Some(value) = std::env::var_os(key) { command.env(key, value); }
        }
        command.env("PATH", "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin");
    } else {
        command.env("PATH", "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin").env("LANG", "en_US.UTF-8").env("TMPDIR", std::env::temp_dir());
        if let Some(home) = std::env::var_os("HOME") { command.env("HOME", home); }
    }
}

pub(super) fn auth_command(windows:bool,directory:&str,runtime:&str)->String {
    let flags="--no-tools --no-extensions --no-mcp --no-skills --no-prompt-templates --no-themes --no-context-files --no-approve";
    if windows {let quote=|value:&str|format!("'{}'",value.replace('\'',"''"));format!("$env:PI_CODING_AGENT_DIR={}; $env:PI_OFFLINE='1'; $env:PI_TELEMETRY='0'; & {} {flags}",quote(directory),quote(runtime))}
    else {let quote=|value:&str|format!("'{}'",value.replace('\'',"'\"'\"'"));format!("PI_CODING_AGENT_DIR={} PI_OFFLINE=1 PI_TELEMETRY=0 {} {flags}",quote(directory),quote(runtime))}
}

fn windows_alias(component: &str) -> bool {
    let base = component.split('.').next().unwrap_or("").to_ascii_uppercase();
    component.contains(':') || component.ends_with(['.', ' ']) ||
        matches!(base.as_str(), "CON" | "PRN" | "AUX" | "NUL" | "CONIN$" | "CONOUT$") ||
        ["COM", "LPT"].iter().any(|prefix| base.strip_prefix(prefix).is_some_and(|n| matches!(n, "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "¹" | "²" | "³")))
}

pub(super) fn windows_tool_path_forbidden(relative: &str) -> bool {
    relative.split(['/', '\\']).filter(|part| !part.is_empty() && *part != ".").any(|part| part.eq_ignore_ascii_case(".git") || windows_alias(part))
}

/// Called only after the fixed official archive checksum has matched.
pub(super) fn extract_windows_zip(bytes: &[u8], staging: &Path) -> io::Result<()> {
    let mut archive = zip::ZipArchive::new(io::Cursor::new(bytes)).map_err(io::Error::other)?;
    for index in 0..archive.len() {
        let mut entry = archive.by_index(index).map_err(io::Error::other)?;
        let name = entry.name();
        let relative = entry.enclosed_name().ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, "Pi archive path leaves staging"))?;
        if name.contains('\\') || relative.components().any(|part| !matches!(part, Component::Normal(_) | Component::CurDir)) ||
            relative.components().any(|part| windows_alias(&part.as_os_str().to_string_lossy())) ||
            entry.unix_mode().is_some_and(|mode| mode & 0o170000 == 0o120000) {
            return Err(io::Error::new(io::ErrorKind::InvalidData, "unsupported Pi archive path or link"));
        }
        let target = staging.join(relative);
        if entry.is_dir() { fs::create_dir_all(&target)?; }
        else { if let Some(parent) = target.parent() { fs::create_dir_all(parent)?; } io::copy(&mut entry, &mut fs::File::create(target)?)?; }
    }
    Ok(())
}

pub(super) fn broker_endpoint(id: &str) -> PathBuf {
    if cfg!(windows) { PathBuf::from(format!(r"\\.\pipe\horizon-pi-{id}")) }
    else { std::env::temp_dir().join(format!("hzn-{id}.sock")) }
}

#[cfg(windows)]
pub(super) fn private_pipe(path: &Path, first: bool) -> io::Result<tokio::net::windows::named_pipe::NamedPipeServer> {
    use std::{mem::{size_of, zeroed}, os::windows::io::{AsRawHandle, FromRawHandle, OwnedHandle}};
    use windows_sys::Win32::{
        Foundation::{LocalFree, HANDLE},
        Security::{GetTokenInformation, TokenUser, TOKEN_QUERY, TOKEN_USER, SECURITY_ATTRIBUTES,
            Authorization::{ConvertSidToStringSidW, ConvertStringSecurityDescriptorToSecurityDescriptorW}},
        System::Threading::{GetCurrentProcess, OpenProcessToken},
    };
    let mut token: HANDLE = std::ptr::null_mut();
    if unsafe { OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token) } == 0 { return Err(io::Error::last_os_error()); }
    let token = unsafe { OwnedHandle::from_raw_handle(token) };
    let mut needed = 0;
    unsafe { GetTokenInformation(token.as_raw_handle(), TokenUser, std::ptr::null_mut(), 0, &mut needed); }
    if needed == 0 { return Err(io::Error::last_os_error()); }
    let mut buffer = vec![0usize; (needed as usize).div_ceil(size_of::<usize>())];
    if unsafe { GetTokenInformation(token.as_raw_handle(), TokenUser, buffer.as_mut_ptr().cast(), needed, &mut needed) } == 0 { return Err(io::Error::last_os_error()); }
    let user = unsafe { &*buffer.as_ptr().cast::<TOKEN_USER>() };
    let mut sid = std::ptr::null_mut();
    if unsafe { ConvertSidToStringSidW(user.User.Sid, &mut sid) } == 0 { return Err(io::Error::last_os_error()); }
    let mut len = 0; while unsafe { *sid.add(len) } != 0 { len += 1; }
    let sid_string = String::from_utf16_lossy(unsafe { std::slice::from_raw_parts(sid, len) });
    unsafe { LocalFree(sid.cast()); }
    // Equivalent to the Unix 0600 socket: current user plus LocalSystem only.
    let descriptor = format!("D:P(A;;GA;;;{sid_string})(A;;GA;;;SY)").encode_utf16().chain(Some(0)).collect::<Vec<_>>();
    let mut security = std::ptr::null_mut();
    if unsafe { ConvertStringSecurityDescriptorToSecurityDescriptorW(descriptor.as_ptr(), 1, &mut security, std::ptr::null_mut()) } == 0 { return Err(io::Error::last_os_error()); }
    let mut attributes: SECURITY_ATTRIBUTES = unsafe { zeroed() };
    attributes.nLength = size_of::<SECURITY_ATTRIBUTES>() as u32; attributes.lpSecurityDescriptor = security;
    let pipe = unsafe { tokio::net::windows::named_pipe::ServerOptions::new().first_pipe_instance(first).reject_remote_clients(true).create_with_security_attributes_raw(path, (&mut attributes as *mut SECURITY_ATTRIBUTES).cast()) };
    unsafe { LocalFree(security); }
    pipe
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn fixed_assets_are_platform_specific_and_fail_closed() {
        assert_eq!(asset_for("linux", "x86_64"), Some(("pi-linux-x64.tar.gz", "f2e4e4329603223d03260cdb8bd5033dbdc1f73ba58ab8939db2e56546e115d2", 42_645_744)));
        assert_eq!(asset_for("linux", "aarch64").unwrap().0, "pi-linux-arm64.tar.gz");
        assert_eq!(asset_for("macos", "x86_64").unwrap().0, "pi-darwin-x64.tar.gz");
        for (os, arch) in [("linux", "x86_64"), ("linux", "aarch64"), ("macos", "x86_64"), ("macos", "aarch64"), ("windows", "x86_64"), ("windows", "aarch64")] {
            let (_, digest, bytes) = asset_for(os, arch).unwrap();
            assert_eq!(digest.len(), 64);
            assert!(bytes > 0);
            assert!(runtime_folder(os, arch).is_some());
        }
        for (os, arch) in [("linux", "riscv64"), ("linux", "x86"), ("freebsd", "x86_64")] {
            assert!(asset_for(os, arch).is_none());
            assert!(runtime_folder(os, arch).is_none());
        }
        assert_eq!(runtime_folder("linux", "x86_64"), Some("linux-x64"));
        assert_eq!(runtime_folder("linux", "aarch64"), Some("linux-arm64"));
    }

    #[test]
    fn windows_fixed_assets_paths_zip_and_environment() {
        assert_eq!(asset_for("windows", "x86_64").unwrap(), ("pi-windows-x64.zip", "0f7256ea8bdac3af20012b94fdc1252a31cc6dc0d2f9b9eb539555d22e3e321b", 45_136_547));
        assert_eq!(asset_for("windows", "aarch64").unwrap().2, 43_770_747);
        for name in [".GIT/config", "x\\.Git\\config", "file:stream", "CON.txt", "LPT1", "folder./file", "file "] { assert!(windows_tool_path_forbidden(name), "{name}"); }
        assert!(!windows_tool_path_forbidden("src/中文.ts"));
        let command=auth_command(true,r"C:\Owned User's\auth",r"C:\Pi User\pi.exe");assert!(command.starts_with("$env:PI_CODING_AGENT_DIR='C:\\Owned User''s\\auth';"));assert!(command.contains("& 'C:\\Pi User\\pi.exe' --no-tools"));
        let fixture = tempfile::tempdir().unwrap();
        let mut writer = zip::ZipWriter::new(io::Cursor::new(Vec::new()));
        writer.start_file("pi.exe", zip::write::SimpleFileOptions::default()).unwrap(); writer.write_all(b"owned fixture, never execute").unwrap();
        let bytes = writer.finish().unwrap().into_inner(); extract_windows_zip(&bytes, fixture.path()).unwrap();
        assert_eq!(fs::read(fixture.path().join("pi.exe")).unwrap(), b"owned fixture, never execute");
        let mut bad = zip::ZipWriter::new(io::Cursor::new(Vec::new()));
        bad.start_file("../outside", zip::write::SimpleFileOptions::default()).unwrap(); bad.write_all(b"bad").unwrap();
        assert!(extract_windows_zip(&bad.finish().unwrap().into_inner(), fixture.path()).is_err());
        let mut command = Command::new("not-executed"); command.env("HORIZON_MODEL_KEY", "owned-test-secret").env("HORIZON_BROKER_TOKEN", "owned-test-token"); environment(&mut command, false);
        assert!(!command.get_envs().any(|(key, _)| key == "HORIZON_MODEL_KEY" || key == "HORIZON_BROKER_TOKEN"));
    }
}
