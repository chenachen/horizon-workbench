use horizon_extension_host::{read_frame, write_frame, MAX_FRAME};
use serde_json::{json, Value};
use std::{
    io,
    process::{Child, ChildStdin, Command, Stdio},
    sync::mpsc::{self, Receiver},
    thread,
    time::{Duration, Instant},
};

struct Host {
    child: Child,
    input: ChildStdin,
    frames: Receiver<Result<Value, String>>,
    activation: String,
    events: Vec<Value>,
}
impl Host {
    fn new(activation: &str) -> Self {
        let mut child = Command::new(env!("CARGO_BIN_EXE_horizon-extension-host"))
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .unwrap();
        let input = child.stdin.take().unwrap();
        let mut output = child.stdout.take().unwrap();
        let (tx, frames) = mpsc::channel();
        thread::spawn(move || loop {
            let frame = read_frame(&mut output).map_err(|error| error.to_string());
            let done = frame.is_err();
            if tx.send(frame).is_err() || done {
                break;
            }
        });
        let mut host = Self {
            child,
            input,
            frames,
            activation: activation.into(),
            events: Vec::new(),
        };
        let hello = json!({"type":"hello","protocolVersion":1,"hostEpoch":format!("epoch-{activation}"),"packageDigest":"test-digest"});
        host.send(hello.clone());
        assert_eq!(host.next(), hello);
        host
    }
    fn send(&mut self, frame: Value) {
        write_frame(&mut self.input, &frame).unwrap();
    }
    fn next(&self) -> Value {
        self.frames
            .recv_timeout(Duration::from_secs(4))
            .expect("sidecar did not respond")
            .expect("sidecar disconnected")
    }
    fn activate(
        &mut self,
        source: &str,
        manifest: Value,
        broker: impl FnMut(&Value) -> Value,
    ) -> Value {
        self.send(json!({"type":"request","id":"activate","activationHandle":self.activation,"method":"activate","params":{"source":source,"manifest":manifest}}));
        self.until_reply("activate", broker)
    }
    fn until_reply(&mut self, id: &str, mut broker: impl FnMut(&Value) -> Value) -> Value {
        loop {
            let frame = self.next();
            match frame["type"].as_str() {
                Some("request") => {
                    assert_eq!(frame["activationHandle"], self.activation);
                    let data = broker(&frame);
                    self.send(json!({"type":"reply","id":frame["id"],"result":{"ok":true,"requestId":frame["id"],"data":data}}));
                }
                Some("event") => {
                    assert_eq!(frame["activationHandle"], self.activation);
                    self.events.push(frame);
                }
                Some("reply") if frame["id"] == id => return frame["result"].clone(),
                _ => panic!("unexpected frame {frame}"),
            }
        }
    }
    fn execute(&mut self, command: &str, broker: impl FnMut(&Value) -> Value) -> Value {
        self.send(json!({"type":"request","id":"execute","activationHandle":self.activation,"method":"execute","params":{"commandId":command,"args":{"value":7}}}));
        self.until_reply("execute", broker)
    }
    fn dispose(&mut self) {
        self.send(json!({"type":"dispose","activationHandle":self.activation,"reason":"test"}));
        loop {
            let frame = self.next();
            if frame["type"] == "disposed" {
                assert_eq!(frame["remainingLeaseIds"], json!([]));
                break;
            }
        }
        assert!(self.child.wait().unwrap().success());
    }
    fn wait_failure(&mut self) {
        let deadline = Instant::now() + Duration::from_secs(2);
        loop {
            if let Some(status) = self.child.try_wait().unwrap() {
                assert!(!status.success());
                break;
            }
            assert!(Instant::now() < deadline, "sidecar did not exit");
            thread::sleep(Duration::from_millis(5));
        }
    }
}
impl Drop for Host {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}
fn manifest() -> Value {
    json!({"id":"test.extension","contributes":{"commands":[{"id":"test.extension.run"}],"views":[{"id":"test.extension.list","renderer":"declarative"}]}})
}
const HEALTHY: &str = r#"export function activate(ctx) { ctx.commands.register('test.extension.run', args => ({value: args.value + 1})); }"#;

#[test]
fn async_broker_wait_does_not_spend_cpu_budget() {
    let mut host = Host::new("async");
    let source = r#"export async function activate(ctx) { const status=await ctx.git.status(); ctx.commands.register('test.extension.run',()=>status); }"#;
    let result = host.activate(source, manifest(), |request| {
        assert_eq!(request["method"], "git.status");
        thread::sleep(Duration::from_millis(180));
        json!({"entries":[{"path":"真实文件.ts"}]})
    });
    assert_eq!(result["ok"], true);
    let result = host.execute("test.extension.run", |_| panic!("unexpected request"));
    assert_eq!(result["data"]["entries"][0]["path"], "真实文件.ts");
    host.dispose();
}

#[test]
fn infinite_loop_interrupt_does_not_kill_other_activation() {
    let mut healthy = Host::new("healthy");
    assert_eq!(
        healthy.activate(HEALTHY, manifest(), |_| Value::Null)["ok"],
        true
    );
    let mut bad = Host::new("loop");
    let started = Instant::now();
    let result = bad.activate(
        "export function activate(){while(true){}}",
        manifest(),
        |_| Value::Null,
    );
    assert_eq!(result["ok"], false);
    bad.wait_failure();
    assert!(started.elapsed() < Duration::from_secs(2));
    assert_eq!(
        healthy.execute("test.extension.run", |_| Value::Null)["data"]["value"],
        8
    );
    healthy.dispose();
}

#[test]
fn heap_limit_rejects_allocation_and_other_activation_survives() {
    let mut healthy = Host::new("heap-healthy");
    assert_eq!(
        healthy.activate(HEALTHY, manifest(), |_| Value::Null)["ok"],
        true
    );
    let mut bad = Host::new("heap");
    let result = bad.activate(
        "export function activate(){globalThis.huge=new ArrayBuffer(64*1024*1024)}",
        manifest(),
        |_| Value::Null,
    );
    assert_eq!(result["ok"], false);
    assert!(
        result["error"]["message"]
            .as_str()
            .unwrap()
            .to_lowercase()
            .contains("memory"),
        "{result}"
    );
    bad.wait_failure();
    assert_eq!(
        healthy.execute("test.extension.run", |_| Value::Null)["ok"],
        true
    );
    healthy.dispose();
}

#[test]
fn no_node_network_or_filesystem_api_is_exposed() {
    let mut host = Host::new("apis");
    let source = r#"export function activate(ctx) {ctx.commands.register('test.extension.run',()=>['process','require','fetch','XMLHttpRequest','WebSocket','Worker','std','os','__send','setTimeout'].map(name=>typeof globalThis[name]));}"#;
    assert_eq!(
        host.activate(source, manifest(), |_| Value::Null)["ok"],
        true
    );
    assert_eq!(
        host.execute("test.extension.run", |_| Value::Null)["data"],
        json!(vec!["undefined"; 10])
    );
    host.dispose();
    let mut imported = Host::new("import");
    assert_eq!(
        imported.activate(
            "import fs from 'node:fs'; export function activate(){}",
            manifest(),
            |_| Value::Null
        )["ok"],
        false
    );
    imported.wait_failure();
}

#[test]
fn promise_microtask_spin_is_bounded() {
    let mut host = Host::new("microtasks");
    let started = Instant::now();
    let result = host.activate(
        "export async function activate(){while(true){await Promise.resolve();}}",
        manifest(),
        |_| Value::Null,
    );
    assert_eq!(result["ok"], false);
    host.wait_failure();
    assert!(started.elapsed() < Duration::from_secs(3));
}

#[test]
fn activation_identity_cannot_cross_pipe() {
    let mut host = Host::new("owned");
    assert_eq!(
        host.activate(HEALTHY, manifest(), |_| Value::Null)["ok"],
        true
    );
    host.send(json!({"type":"request","id":"forged","activationHandle":"other-activation","method":"execute","params":{"commandId":"test.extension.run"}}));
    host.wait_failure();
}

#[test]
fn thirty_activate_dispose_cycles_reap_every_process() {
    for cycle in 0..30 {
        let mut host = Host::new(&format!("cycle-{cycle}"));
        assert_eq!(
            host.activate(HEALTHY, manifest(), |_| Value::Null)["ok"],
            true
        );
        assert_eq!(
            host.execute("test.extension.run", |_| Value::Null)["ok"],
            true
        );
        host.dispose();
        assert!(host.child.try_wait().unwrap().is_some());
    }
}

#[test]
fn protocol_rejects_oversized_frames_before_allocating() {
    let mut input = io::Cursor::new(((MAX_FRAME + 1) as u32).to_be_bytes());
    assert_eq!(
        read_frame(&mut input).unwrap_err().kind(),
        io::ErrorKind::InvalidData
    );
}

#[test]
fn overlapping_command_returns_busy_without_failing_activation() {
    let mut host = Host::new("busy");
    let source="export function activate(ctx){ctx.commands.register('test.extension.run',()=>ctx.git.status())}";
    assert_eq!(
        host.activate(source, manifest(), |_| Value::Null)["ok"],
        true
    );
    host.send(json!({"type":"request","id":"first","activationHandle":host.activation,"method":"execute","params":{"commandId":"test.extension.run"}}));
    let request = host.next();
    assert_eq!(request["type"], "request");
    host.send(json!({"type":"request","id":"second","activationHandle":host.activation,"method":"execute","params":{"commandId":"test.extension.run"}}));
    let busy = host.next();
    assert_eq!(busy["id"], "second");
    assert_eq!(busy["result"]["error"]["code"], "RESOURCE_BUSY");
    host.send(json!({"type":"reply","id":request["id"],"result":{"ok":true,"requestId":request["id"],"data":{"entries":[]}}}));
    assert_eq!(host.until_reply("first", |_| Value::Null)["ok"], true);
    assert_eq!(
        host.execute("test.extension.run", |_| json!({"entries":[]}))["ok"],
        true
    );
    host.dispose();
}

#[test]
fn dispose_rejects_pending_sdk_requests_and_releases_process() {
    let mut host = Host::new("pending-dispose");
    let source="export function activate(ctx){ctx.commands.register('test.extension.run',()=>ctx.git.status())}";
    assert_eq!(
        host.activate(source, manifest(), |_| Value::Null)["ok"],
        true
    );
    host.send(json!({"type":"request","id":"pending","activationHandle":host.activation,"method":"execute","params":{"commandId":"test.extension.run"}}));
    assert_eq!(host.next()["type"], "request");
    host.dispose();
}

#[test]
fn denied_capability_rejects_promise_and_extension_can_handle_it() {
    let mut host = Host::new("denied");
    let source="export function activate(ctx){ctx.commands.register('test.extension.run',async()=>{try{await ctx.git.status()}catch(error){return error.message}})}";
    assert_eq!(
        host.activate(source, manifest(), |_| Value::Null)["ok"],
        true
    );
    host.send(json!({"type":"request","id":"denied","activationHandle":host.activation,"method":"execute","params":{"commandId":"test.extension.run"}}));
    let request = host.next();
    host.send(json!({"type":"reply","id":request["id"],"result":{"ok":false,"requestId":request["id"],"error":{"code":"PERMISSION_DENIED","message":"git.read not granted"}}}));
    let result = host.until_reply("denied", |_| Value::Null);
    assert_eq!(result["ok"], true);
    assert_eq!(result["data"], "git.read not granted");
    host.dispose();
}

#[test]
#[ignore = "Exercises the production 30-second asynchronous deadline"]
fn unresolved_activation_has_a_30_second_deadline() {
    let mut host = Host::new("never-resolves");
    let started = Instant::now();
    host.send(json!({"type":"request","id":"activate","activationHandle":host.activation,"method":"activate","params":{"source":"export async function activate(){await new Promise(()=>{})}","manifest":manifest()}}));
    let frame = host
        .frames
        .recv_timeout(Duration::from_secs(33))
        .expect("deadline did not fire")
        .expect("expected failure reply");
    assert_eq!(frame["type"], "reply");
    assert_eq!(frame["result"]["ok"], false);
    assert!(frame["result"]["error"]["message"]
        .as_str()
        .unwrap()
        .contains("30 seconds"));
    assert!(started.elapsed() >= Duration::from_secs(30));
    assert!(started.elapsed() < Duration::from_secs(33));
    host.wait_failure();
}

#[test]
fn shipped_example_uses_real_git_data_via_async_capability_requests() {
    let root = std::env::temp_dir().join(format!("horizon-quickjs-git-{}", std::process::id()));
    std::fs::create_dir_all(&root).unwrap();
    let git = |args: &[&str]| {
        let output = Command::new("git")
            .args(args)
            .current_dir(&root)
            .output()
            .unwrap();
        assert!(output.status.success());
        output.stdout
    };
    git(&["init", "-q"]);
    std::fs::write(root.join("真实更改.txt"), "真实 Git 数据\n").unwrap();
    let mut host = Host::new("sample");
    let manifest: Value = serde_json::from_str(include_str!(
        "../../../packages/plugins/examples/read-only-changes/manifest.json"
    ))
    .unwrap();
    let source = include_str!("../../../packages/plugins/examples/read-only-changes/index.js");
    let mut git_calls = 0;
    let mut broker = |request: &Value| match request["method"].as_str().unwrap() {
        "git.status" => {
            git_calls += 1;
            let bytes = git(&["status", "--porcelain=v1", "-z"]);
            let files:Vec<Value>=bytes.split(|byte|*byte==0).filter(|entry|entry.len()>3).map(|entry|json!({"path":String::from_utf8_lossy(&entry[3..]),"index":String::from_utf8_lossy(&entry[..1]),"worktree":String::from_utf8_lossy(&entry[1..2]),"kind":if entry[0]==b'?' {"untracked"} else {"ordinary"}})).collect();
            json!({"files":files})
        }
        "settings.get" => json!(true),
        "storage.set" => json!({"saved":true}),
        method => panic!("unexpected {method}"),
    };
    assert_eq!(host.activate(source, manifest, &mut broker)["ok"], true);
    assert_eq!(
        host.execute("local.read-only-changes.refresh", &mut broker)["ok"],
        true
    );
    assert_eq!(git_calls, 2);
    assert!(host.events.iter().any(|event| event["event"] == "view"
        && event["data"]["view"]["items"][0]["label"] == "真实更改.txt"));
    host.dispose();
    std::fs::remove_dir_all(root).unwrap();
}
