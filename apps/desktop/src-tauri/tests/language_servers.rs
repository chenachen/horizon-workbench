use horizon_host::{extensions, language_servers, state, Call, HostError, HostState};
use serde_json::{json, Value};
use std::{fs, path::Path, sync::Arc, time::Duration};
use tauri::ipc::{Channel, InvokeResponseBody};
use tokio::sync::mpsc;

struct Fixture {
    data: tempfile::TempDir,
    root: tempfile::TempDir,
    state: Arc<HostState>,
    project: String,
    extension: String,
}

struct Connection {
    info: Value,
    events: mpsc::UnboundedReceiver<Value>,
}

impl Fixture {
    fn new() -> Self {
        let data = tempfile::tempdir().unwrap();
        let root = tempfile::tempdir().unwrap();
        let state = Arc::new(HostState::new(data.path().into()).unwrap());
        extensions::initialize(&state).unwrap();
        let project = Self::register(&state, root.path());
        Self {
            data,
            root,
            state,
            project,
            extension: format!("local.lsp-{}", state::id()),
        }
    }

    fn register(state: &HostState, path: &Path) -> String {
        let registered = state.register_project(path.into(), None, None).unwrap();
        let project = registered["project"]["id"].as_str().unwrap().to_owned();
        state.epochs.lock().unwrap().insert(project.clone(), 1);
        project
    }

    fn call_for(&self, project: &str, method: &str, params: Value) -> Call {
        Call {
            protocol_version: 1,
            request_id: state::id(),
            method: method.into(),
            scope: json!({"kind":"project", "projectId":project, "projectEpoch":1}),
            params,
            idempotency_key: Some(state::id()),
        }
    }

    fn call(&self, method: &str, params: Value) -> Call {
        self.call_for(&self.project, method, params)
    }

    fn file(&self, name: &str, content: &str) -> Value {
        let path = self.root.path().join(name);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(&path, content).unwrap();
        self.state.file_ref(&self.project, &path).unwrap()
    }

    fn install(&self, command: &str, args: Value, language: &str, suffix: &str) {
        let registry_path = self.data.path().join("extensions/registry.json");
        let mut registry: Value =
            serde_json::from_slice(&fs::read(&registry_path).unwrap()).unwrap();
        registry["records"][&self.extension] = json!({
            "manifest": {
                "id":self.extension, "version":"1.0.0", "runtime":{"kind":"declarative"},
                "activation":[], "requires":{}, "optional":{}, "capabilities":["language.server"],
                "contributes": {
                    "languages":[{"id":language, "extensions":[suffix]}],
                    "languageServers":[{
                        "id":"fixture", "languageIds":[language], "rootMarkers":["package.json", "Cargo.toml"],
                        "command":command, "args":args,
                        "initializationOptions":{
                            "checkOnSave":false,
                            "cargo":{"buildScripts":{"enable":false}},
                            "procMacro":{"enable":false}
                        }
                    }]
                }
            },
            "packageDir":self.data.path(), "revision":1, "installed":true,
            "enabledGlobal":true, "pausedGlobal":false, "projects":{},
            "activations":{}, "stopping":{}, "errors":{}, "grants":["language.server"],
            "config":{}, "projectConfig":{}, "logs":[]
        });
        fs::write(registry_path, serde_json::to_vec(&registry).unwrap()).unwrap();
    }

    fn install_echo(&self) {
        self.install(
            "python3",
            json!([
                "-u",
                "-c",
                ECHO_SERVER,
                self.data.path().join("methods.jsonl")
            ]),
            "fixture",
            ".fixture",
        );
    }

    async fn connect_for(&self, project: &str, file: &Value) -> Connection {
        let (sender, events) = mpsc::unbounded_channel();
        let channel = Channel::new(move |body| {
            if let InvokeResponseBody::Json(body) = body {
                sender.send(serde_json::from_str(&body).unwrap()).unwrap();
            }
            Ok(())
        });
        let info = language_servers::dispatch(
            self.state.clone(),
            self.call_for(
                project,
                "language_server_connect",
                json!({"fileId":file["fileId"], "serverId":"fixture"}),
            ),
            Some(channel),
        )
        .await
        .unwrap();
        Connection { info, events }
    }

    async fn connect(&self, file: &Value) -> Connection {
        self.connect_for(&self.project, file).await
    }

    async fn send(&self, connection: &Connection, message: Value) -> Result<Value, HostError> {
        language_servers::dispatch(
            self.state.clone(),
            self.call(
                "language_server_send",
                json!({"sessionId":connection.info["sessionId"], "message":message.to_string()}),
            ),
            None,
        )
        .await
    }

    async fn response(&self, connection: &mut Connection, id: i64) -> Value {
        tokio::time::timeout(Duration::from_secs(30), async {
            loop {
                let event = connection
                    .events
                    .recv()
                    .await
                    .expect("language server channel ended");
                assert_ne!(
                    event["type"], "closed",
                    "server closed before response: {event}"
                );
                if event["type"] != "message" {
                    continue;
                }
                let message: Value =
                    serde_json::from_str(event["message"].as_str().unwrap()).unwrap();
                if message["method"].is_string() && !message["id"].is_null() {
                    let result = match message["method"].as_str().unwrap() {
                        "workspace/configuration" => Value::Array(
                            message["params"]["items"]
                                .as_array()
                                .unwrap()
                                .iter()
                                .map(|_| json!(null))
                                .collect(),
                        ),
                        "workspace/workspaceFolders" => {
                            json!([{"uri":connection.info["rootUri"], "name":"fixture"}])
                        }
                        _ => Value::Null,
                    };
                    self.send(
                        connection,
                        json!({"jsonrpc":"2.0", "id":message["id"], "result":result}),
                    )
                    .await
                    .unwrap();
                } else if message["id"] == id {
                    assert!(
                        message.get("error").is_none(),
                        "LSP request failed: {message}"
                    );
                    return message["result"].clone();
                }
            }
        })
        .await
        .expect("timed out waiting for language server response")
    }

    async fn initialize(&self, connection: &mut Connection) {
        self.send(connection, json!({
            "jsonrpc":"2.0", "id":1, "method":"initialize",
            "params": {
                "processId":std::process::id(), "rootUri":connection.info["rootUri"],
                "workspaceFolders":[{"uri":connection.info["rootUri"], "name":"fixture"}],
                "capabilities":{"general":{"positionEncodings":["utf-16"]}, "textDocument":{"definition":{"linkSupport":true}}},
                "initializationOptions":connection.info["initializationOptions"]
            }
        })).await.unwrap();
        let initialized = self.response(connection, 1).await;
        assert!(initialized["capabilities"].is_object());
        self.send(
            connection,
            json!({"jsonrpc":"2.0", "method":"initialized", "params":{}}),
        )
        .await
        .unwrap();
    }

    async fn stop(&self) {
        language_servers::stop_extension(&self.extension, Some(&self.project))
            .await
            .unwrap();
        assert!(language_servers::resources(Some(&self.project)).is_empty());
    }
}

const ECHO_SERVER: &str = r#"
import json, os, sys

def frame(value):
    body = json.dumps(value, ensure_ascii=False).encode('utf-8')
    return ('Content-Length: %d\r\n\r\n' % len(body)).encode('ascii') + body

while True:
    headers = {}
    while True:
        line = sys.stdin.buffer.readline()
        if not line:
            sys.exit(0)
        if line in (b'\r\n', b'\n'):
            break
        name, value = line.split(b':', 1)
        headers[name.lower()] = value.strip()
    message = json.loads(sys.stdin.buffer.read(int(headers[b'content-length'])))
    method = message.get('method')
    with open(sys.argv[1], 'a') as log:
        log.write(json.dumps(method) + '\n')
    if method == 'exit' or method == 'fixture/quit':
        sys.exit(0)
    if method == 'fixture/fragment':
        os.write(2, b'log line\n' * 16384)
        wire = frame({'jsonrpc':'2.0', 'method':'fixture/notice', 'params':'多帧😀'})
        wire += frame({'jsonrpc':'2.0', 'id':message['id'], 'result':message['params']})
        for start in range(0, len(wire), 3):
            os.write(1, wire[start:start + 3])
    elif method == 'initialize':
        os.write(1, frame({'jsonrpc':'2.0', 'id':message['id'], 'result':{'capabilities':{'definitionProvider':True}}}))
    elif 'id' in message:
        os.write(1, frame({'jsonrpc':'2.0', 'id':message['id'], 'result':message.get('params')}))
"#;

#[cfg(unix)]
#[tokio::test]
async fn stdio_reuses_workspace_and_handles_fragmented_utf8_frames_and_shutdown() {
    let fixture = Fixture::new();
    fixture.install_echo();
    fixture.file("package.json", "{}");
    let first = fixture.file("一.fixture", "first");
    let second = fixture.file("nested/二.fixture", "second");
    let mut connection = fixture.connect(&first).await;
    let reused = fixture.connect(&second).await;
    assert_eq!(connection.info["reused"], false);
    assert_eq!(reused.info["reused"], true);
    assert!(connection.info["revision"].as_u64().is_some());
    assert_eq!(reused.info["revision"],connection.info["revision"]);
    assert_eq!(connection.info["sessionId"], reused.info["sessionId"]);
    assert_ne!(connection.info["fileUri"], reused.info["fileUri"]);
    assert_eq!(
        language_servers::resource_count(&fixture.extension, Some(&fixture.project)),
        1
    );
    fixture.send(&connection, json!({"jsonrpc":"2.0", "id":7, "method":"fixture/fragment", "params":{"text":"中文😀\n未保存"}})).await.unwrap();
    assert_eq!(
        fixture.response(&mut connection, 7).await,
        json!({"text":"中文😀\n未保存"})
    );
    fixture.stop().await;
    let methods = fs::read_to_string(fixture.data.path().join("methods.jsonl")).unwrap();
    assert!(methods.contains("\"shutdown\""));
    assert!(methods.contains("\"exit\""));
}

#[cfg(unix)]
#[tokio::test]
async fn queued_prewarm_cannot_revive_sleeping_server_but_fresh_query_can() {
    let fixture = Fixture::new();
    fixture.install_echo();
    let first = fixture.file("main.fixture", "main");
    let second = fixture.file("lib.fixture", "lib");
    let first_call = fixture.call(
        "language_server_connect",
        json!({"fileId":first["fileId"],"expectedRevision":1}),
    );
    let second_call = fixture.call(
        "language_server_connect",
        json!({"fileId":second["fileId"],"expectedRevision":1}),
    );
    let (first_result, second_result) = tokio::join!(
        language_servers::dispatch(
            fixture.state.clone(),
            first_call,
            Some(Channel::new(|_| Ok(())))
        ),
        language_servers::dispatch(
            fixture.state.clone(),
            second_call,
            Some(Channel::new(|_| Ok(())))
        ),
    );
    let first_session = first_result.unwrap();
    let second_session = second_result.unwrap();
    assert_eq!(
        first_session["sessionId"], second_session["sessionId"],
        "activation's own revision bump must not reject another initial file"
    );
    assert_ne!(first_session["reused"], second_session["reused"]);
    let registry_path = fixture.data.path().join("extensions/registry.json");
    let registry: Value = serde_json::from_slice(&fs::read(&registry_path).unwrap()).unwrap();
    let prior_revision = registry["records"][&fixture.extension]["revision"].clone();
    let pending_call = fixture.call(
        "language_server_connect",
        json!({"fileId":first["fileId"],"expectedRevision":prior_revision}),
    );
    let serial = fixture.state.write_lock.lock().await;
    let queued_state = fixture.state.clone();
    let (started, received) = tokio::sync::oneshot::channel();
    let queued = tokio::spawn(async move {
        let _ = started.send(());
        language_servers::dispatch(queued_state, pending_call, Some(Channel::new(|_| Ok(())))).await
    });
    received.await.unwrap();
    tokio::task::yield_now().await;
    assert!(
        !queued.is_finished(),
        "prewarm must be waiting behind the lifecycle write lock"
    );
    extensions::sleep_project(&fixture.state, &fixture.project)
        .await
        .unwrap();
    drop(serial);
    assert_eq!(queued.await.unwrap().unwrap_err().code, "STALE_VERSION");
    assert!(language_servers::resources(Some(&fixture.project)).is_empty());
    let sleeping: Value = serde_json::from_slice(&fs::read(&registry_path).unwrap()).unwrap();
    assert_eq!(
        sleeping["records"][&fixture.extension]["sleeping"][&fixture.project],
        true
    );
    assert!(sleeping["records"][&fixture.extension]["activations"][&fixture.project].is_null());
    let current_revision = sleeping["records"][&fixture.extension]["revision"].clone();
    let explicit = language_servers::dispatch(
        fixture.state.clone(),
        fixture.call(
            "language_server_connect",
            json!({"fileId":first["fileId"],"expectedRevision":current_revision}),
        ),
        Some(Channel::new(|_| Ok(()))),
    )
    .await
    .unwrap();
    assert_eq!(explicit["reused"], false);
    assert!(explicit["revision"].as_u64().unwrap() > current_revision.as_u64().unwrap(),"wake reply must be newer than the sleeping snapshot");
    assert_ne!(explicit["sessionId"], first_session["sessionId"]);
    fixture.stop().await;
}

#[cfg(unix)]
#[tokio::test]
async fn document_metadata_maps_only_authorized_buffers_in_the_same_workspace() {
    let fixture = Fixture::new();
    fixture.install_echo();
    let first = fixture.file("main.fixture", "main");
    let same = fixture.file("lib.fixture", "dirty overlay");
    let unknown = fixture.file("notes.unknown", "notes");
    let nested = fixture.file("nested/lib.fixture", "another workspace");
    fixture.file("nested/package.json", "{}");
    let connection = fixture.connect(&first).await;
    let registry_path = fixture.data.path().join("extensions/registry.json");
    let before = fs::read(&registry_path).unwrap();
    let metadata = language_servers::dispatch(
        fixture.state.clone(),
        fixture.call(
            "language_server_document",
            json!({"sessionId":connection.info["sessionId"],"fileId":same["fileId"]}),
        ),
        None,
    )
    .await
    .unwrap();
    assert_eq!(metadata["languageId"], "fixture");
    assert!(metadata["fileUri"]
        .as_str()
        .unwrap()
        .ends_with("/lib.fixture"));
    for file in [&unknown, &nested] {
        assert!(language_servers::dispatch(
            fixture.state.clone(),
            fixture.call(
                "language_server_document",
                json!({"sessionId":connection.info["sessionId"],"fileId":file["fileId"]})
            ),
            None
        )
        .await
        .unwrap()
        .is_null());
    }
    let outside = tempfile::tempdir().unwrap();
    let other = Fixture::register(&fixture.state, outside.path());
    let path = fixture
        .state
        .project_root(&other)
        .unwrap()
        .join("outside.fixture");
    fs::write(&path, "other project").unwrap();
    let file = fixture.state.file_ref(&other, &path).unwrap();
    for project in [&fixture.project, &other] {
        let error = language_servers::dispatch(
            fixture.state.clone(),
            fixture.call_for(
                project,
                "language_server_document",
                json!({"sessionId":connection.info["sessionId"],"fileId":file["fileId"]}),
            ),
            None,
        )
        .await
        .unwrap_err();
        assert_eq!(error.code, "PERMISSION_DENIED");
    }
    assert_eq!(
        fs::read(&registry_path).unwrap(),
        before,
        "mapping must not activate or alter plugin state"
    );
    assert_eq!(
        language_servers::resource_count(&fixture.extension, Some(&fixture.project)),
        1
    );
    fixture.stop().await;
}

#[cfg(unix)]
#[tokio::test]
async fn sessions_are_project_owned_and_sleep_releases_only_that_project() {
    let fixture = Fixture::new();
    fixture.install_echo();
    let primary = fixture.file("main.fixture", "first");
    let other_root = tempfile::tempdir().unwrap();
    let other = Fixture::register(&fixture.state, other_root.path());
    let other_path = other_root.path().join("main.fixture");
    fs::write(&other_path, "second").unwrap();
    let other_file = fixture.state.file_ref(&other, &other_path).unwrap();
    let mut first = fixture.connect(&primary).await;
    let mut second = fixture.connect_for(&other, &other_file).await;
    assert_ne!(first.info["sessionId"], second.info["sessionId"]);
    let snapshot = language_servers::process_snapshot(Some(&fixture.project));
    assert_eq!(snapshot.len(), 1);
    assert_eq!(snapshot[0]["kind"], "languageServer");
    assert_eq!(snapshot[0]["ownership"], "owned");
    assert_eq!(snapshot[0]["owner"]["projectId"], fixture.project);
    assert_eq!(snapshot[0]["owner"]["extensionId"], fixture.extension);
    let forged = language_servers::dispatch(
        fixture.state.clone(),
        fixture.call_for(
            &other,
            "language_server_send",
            json!({"sessionId":first.info["sessionId"], "message":"{}"}),
        ),
        None,
    )
    .await
    .unwrap_err();
    assert_eq!(forged.code, "PERMISSION_DENIED");
    fixture
        .send(
            &first,
            json!({"jsonrpc":"2.0", "id":10, "method":"fixture/echo", "params":"primary"}),
        )
        .await
        .unwrap();
    assert_eq!(fixture.response(&mut first, 10).await, "primary");
    let stopped = language_servers::stop_process(
        &fixture.state,
        first.info["sessionId"].as_str().unwrap(),
        Some(&fixture.project),
        true,
    )
    .await
    .unwrap()
    .unwrap();
    assert_eq!(stopped, json!({"exited":true, "forced":true}));
    assert!(language_servers::process_snapshot(Some(&fixture.project)).is_empty());
    assert_eq!(language_servers::process_snapshot(Some(&other)).len(), 1);
    let restarted = fixture.connect(&primary).await;
    assert_eq!(restarted.info["reused"], false);
    extensions::sleep_project(&fixture.state, &fixture.project)
        .await
        .unwrap();
    assert!(language_servers::resources(Some(&fixture.project)).is_empty());
    assert_eq!(language_servers::resources(Some(&other)).len(), 1);
    language_servers::dispatch(
        fixture.state.clone(),
        fixture.call_for(&other, "language_server_send", json!({"sessionId":second.info["sessionId"], "message":json!({"jsonrpc":"2.0", "id":11, "method":"fixture/echo", "params":"other"}).to_string()})),
        None,
    ).await.unwrap();
    let result = tokio::time::timeout(Duration::from_secs(5), second.events.recv())
        .await
        .unwrap()
        .unwrap();
    assert_eq!(
        serde_json::from_str::<Value>(result["message"].as_str().unwrap()).unwrap()["result"],
        "other"
    );
    language_servers::stop_extension(&fixture.extension, Some(&other))
        .await
        .unwrap();
    assert!(language_servers::resources(Some(&other)).is_empty());
}

#[cfg(unix)]
#[tokio::test]
async fn unexpected_eof_releases_resources_and_stale_scope_cannot_start() {
    let fixture = Fixture::new();
    fixture.install_echo();
    let file = fixture.file("main.fixture", "first");
    let mut connection = fixture.connect(&file).await;
    fixture
        .send(
            &connection,
            json!({"jsonrpc":"2.0", "method":"fixture/quit"}),
        )
        .await
        .unwrap();
    let closed = tokio::time::timeout(Duration::from_secs(5), connection.events.recv())
        .await
        .unwrap()
        .unwrap();
    assert_eq!(closed["type"], "closed");
    assert!(language_servers::resources(Some(&fixture.project)).is_empty());
    fixture.state.invalidate_project_scope(&fixture.project);
    let channel = Channel::new(|_| Ok(()));
    let error = language_servers::dispatch(
        fixture.state.clone(),
        fixture.call(
            "language_server_connect",
            json!({"fileId":file["fileId"], "serverId":"fixture"}),
        ),
        Some(channel),
    )
    .await
    .unwrap_err();
    assert_eq!(error.code, "STALE_SCOPE");
}

#[tokio::test]
async fn resolve_preserves_project_and_external_file_authorization() {
    let fixture = Fixture::new();
    let file = fixture.file("space 文件.fixture", "text");
    let path = fixture
        .state
        .resolve_file(&fixture.project, file["fileId"].as_str().unwrap())
        .unwrap();
    let resolve = |path: &Path| {
        fixture.call(
            "language_server_resolve",
            json!({"uri":reqwest::Url::from_file_path(path).unwrap().to_string()}),
        )
    };
    let resolved = language_servers::dispatch(fixture.state.clone(), resolve(&path), None)
        .await
        .unwrap();
    assert_eq!(resolved["fileId"], file["fileId"]);
    let alias = fixture.root.path().join("space 文件.fixture");
    assert_eq!(
        language_servers::dispatch(fixture.state.clone(), resolve(&alias), None)
            .await
            .unwrap()["fileId"],
        file["fileId"]
    );
    let outside = fixture
        .data
        .path()
        .canonicalize()
        .unwrap()
        .join("outside.fixture");
    fs::write(&outside, "outside").unwrap();
    let error = language_servers::dispatch(fixture.state.clone(), resolve(&outside), None)
        .await
        .unwrap_err();
    assert_eq!(error.code, "PERMISSION_DENIED");
    assert!(error.message.contains("文件选择器"));
    #[cfg(unix)]
    {
        let project_root = fixture.state.project_root(&fixture.project).unwrap();
        let link = project_root.join("escape.fixture");
        std::os::unix::fs::symlink(&outside, &link).unwrap();
        assert_eq!(
            language_servers::dispatch(fixture.state.clone(), resolve(&link), None)
                .await
                .unwrap_err()
                .code,
            "PERMISSION_DENIED"
        );
        let directory = project_root.join("external");
        std::os::unix::fs::symlink(fixture.data.path(), &directory).unwrap();
        assert_eq!(
            language_servers::dispatch(
                fixture.state.clone(),
                resolve(&directory.join("outside.fixture")),
                None
            )
            .await
            .unwrap_err()
            .code,
            "PERMISSION_DENIED"
        );
    }
    let granted = fixture
        .state
        .authorized_file_ref(&fixture.project, &outside)
        .unwrap();
    assert_eq!(
        language_servers::dispatch(fixture.state.clone(), resolve(&outside), None)
            .await
            .unwrap()["fileId"],
        granted["fileId"]
    );
}

#[tokio::test]
#[ignore = "requires HORIZON_TEST_TYPESCRIPT_LSP pointing to a TypeScript 7 native LSP"]
async fn real_typescript_navigation_uses_unsaved_cross_file_content() {
    let executable =
        std::env::var("HORIZON_TEST_TYPESCRIPT_LSP").expect("TypeScript LSP executable");
    let fixture = Fixture::new();
    fixture.install(
        &executable,
        json!(["--lsp", "--stdio"]),
        "typescript",
        ".ts",
    );
    fixture.file("tsconfig.json", r#"{"compilerOptions":{"module":"esnext","target":"esnext","moduleResolution":"bundler","strict":true},"include":["*.ts"]}"#);
    let dependency = fixture.file("dep.ts", "export function diskOnly() {}\n");
    let consumer = fixture.file("main.ts", "import { unsaved } from './dep';\nunsaved();\n");
    let mut connection = fixture.connect(&consumer).await;
    fixture.initialize(&mut connection).await;
    let dep_path = fixture
        .state
        .resolve_file(&fixture.project, dependency["fileId"].as_str().unwrap())
        .unwrap();
    let dep_uri = reqwest::Url::from_file_path(dep_path).unwrap().to_string();
    fixture.send(&connection, json!({"jsonrpc":"2.0", "method":"textDocument/didOpen", "params":{"textDocument":{"uri":dep_uri, "languageId":"typescript", "version":1, "text":"// 😀 unsaved overlay\nexport function unsaved() {}\n"}}})).await.unwrap();
    fixture.send(&connection, json!({"jsonrpc":"2.0", "method":"textDocument/didOpen", "params":{"textDocument":{"uri":connection.info["fileUri"], "languageId":"typescript", "version":1, "text":"import { unsaved } from './dep';\nunsaved();\n"}}})).await.unwrap();
    fixture.send(&connection, json!({"jsonrpc":"2.0", "id":2, "method":"textDocument/definition", "params":{"textDocument":{"uri":connection.info["fileUri"]}, "position":{"line":1,"character":3}}})).await.unwrap();
    let result = fixture.response(&mut connection, 2).await;
    let target = result
        .as_array()
        .and_then(|targets| targets.first())
        .unwrap_or(&result);
    assert_eq!(
        target
            .get("targetUri")
            .or_else(|| target.get("uri"))
            .unwrap(),
        &dep_uri
    );
    let range = target
        .get("targetSelectionRange")
        .or_else(|| target.get("range"))
        .unwrap();
    assert_eq!(range["start"]["line"], 1);
    assert!(fs::read_to_string(fixture.root.path().join("dep.ts"))
        .unwrap()
        .contains("diskOnly"));
    let resolved = language_servers::dispatch(
        fixture.state.clone(),
        fixture.call("language_server_resolve", json!({"uri":dep_uri})),
        None,
    )
    .await
    .unwrap();
    assert_eq!(resolved["fileId"], dependency["fileId"]);
    fixture.stop().await;
}

#[tokio::test]
#[ignore = "requires HORIZON_TEST_RUST_ANALYZER pointing to rust-analyzer and a Rust toolchain"]
async fn real_rust_navigation_resolves_workspace_definition() {
    let executable = std::env::var("HORIZON_TEST_RUST_ANALYZER").expect("rust-analyzer executable");
    let fixture = Fixture::new();
    fixture.install(&executable, json!([]), "rust", ".rs");
    fixture.file(
        "Cargo.toml",
        "[package]\nname = \"lsp_navigation_fixture\"\nversion = \"0.1.0\"\nedition = \"2021\"\n",
    );
    let content = "fn target() {}\nfn main() { target(); }\n";
    let file = fixture.file("src/main.rs", content);
    let mut connection = fixture.connect(&file).await;
    fixture.initialize(&mut connection).await;
    fixture.send(&connection, json!({"jsonrpc":"2.0", "method":"textDocument/didOpen", "params":{"textDocument":{"uri":connection.info["fileUri"], "languageId":"rust", "version":1, "text":content}}})).await.unwrap();
    let mut target = Value::Null;
    for id in 2..102 {
        fixture.send(&connection, json!({"jsonrpc":"2.0", "id":id, "method":"textDocument/definition", "params":{"textDocument":{"uri":connection.info["fileUri"]}, "position":{"line":1,"character":15}}})).await.unwrap();
        let result = fixture.response(&mut connection, id).await;
        target = result
            .as_array()
            .and_then(|targets| targets.first())
            .cloned()
            .unwrap_or(result);
        if target
            .get("targetUri")
            .or_else(|| target.get("uri"))
            .is_some()
        {
            break;
        }
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
    assert_eq!(
        target
            .get("targetUri")
            .or_else(|| target.get("uri"))
            .unwrap(),
        &connection.info["fileUri"]
    );
    let range = target
        .get("targetSelectionRange")
        .or_else(|| target.get("range"))
        .unwrap();
    assert_eq!(range["start"]["line"], 0);
    fixture.stop().await;
}
