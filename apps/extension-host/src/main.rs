use horizon_extension_host::{read_frame, write_frame, MAX_FRAME};
use rquickjs::{
    Context, Ctx, Function, Module, Object, Persistent, Promise, Runtime, Value as JsValue,
};
use serde_json::{json, Value};
use std::{
    cell::Cell,
    io,
    rc::Rc,
    sync::mpsc,
    thread,
    time::{Duration, Instant},
};

const HEAP_BYTES: usize = 32 * 1024 * 1024;
const SLICE: Duration = Duration::from_millis(50);
const CPU_BUDGET: Duration = Duration::from_millis(500);
const REQUEST_TIMEOUT: Duration = Duration::from_secs(30);

fn output(value: Value) -> Result<(), String> {
    write_frame(&mut io::stdout().lock(), &value).map_err(|error| error.to_string())
}
fn text<'a>(value: &'a Value, name: &str) -> Result<&'a str, String> {
    value[name]
        .as_str()
        .ok_or_else(|| format!("missing {name}"))
}
fn js_error(ctx: &Ctx<'_>, error: rquickjs::Error) -> String {
    if error.is_exception() {
        let exception = ctx.catch();
        if let Some(error) = exception.as_exception() {
            return error
                .message()
                .unwrap_or_else(|| "QuickJS exception".into());
        }
        if let Some(value) = exception.as_string() {
            return value.to_string().unwrap_or_default();
        }
    }
    error.to_string()
}
fn reply(id: &str, value: Result<Value, String>) -> Result<(), String> {
    let result = match value {
        Ok(data) => json!({"ok":true,"requestId":id,"data":data}),
        Err(message) => {
            json!({"ok":false,"requestId":id,"error":{"code":"EXTENSION_FAILED","message":message,"retryable":false}})
        }
    };
    output(json!({"type":"reply","id":id,"result":result}))
}
struct Operation {
    id: String,
    promise: Persistent<Promise<'static>>,
    deadline: Instant,
    cpu: Duration,
    dispose: bool,
}

fn run() -> Result<(), String> {
    // A bounded input queue prevents parent traffic from growing host memory without bound.
    let (tx, rx) = mpsc::sync_channel(32);
    thread::spawn(move || {
        let mut input = io::stdin().lock();
        loop {
            let frame = read_frame(&mut input).map_err(|error| error.to_string());
            let failed = frame.is_err();
            if tx.send(frame).is_err() || failed {
                break;
            }
        }
    });
    let hello = rx
        .recv_timeout(Duration::from_secs(5))
        .map_err(|_| "hello timeout")??;
    if hello["type"] != "hello" || hello["protocolVersion"] != 1 {
        return Err("invalid hello".into());
    }
    text(&hello, "hostEpoch")?;
    text(&hello, "packageDigest")?;
    output(hello)?;

    let runtime = Runtime::new().map_err(|error| error.to_string())?;
    // Do not enable rquickjs rust-alloc/allocator: those bypass QuickJS's heap limiter.
    runtime.set_memory_limit(HEAP_BYTES);
    runtime.set_max_stack_size(256 * 1024);
    runtime.set_gc_threshold(8 * 1024 * 1024);
    let deadline = Rc::new(Cell::new(Instant::now() + SLICE));
    let interrupted = Rc::new(Cell::new(false));
    let deadline_check = deadline.clone();
    let interrupted_check = interrupted.clone();
    runtime.set_interrupt_handler(Some(Box::new(move || {
        let expired = Instant::now() >= deadline_check.get();
        if expired {
            interrupted_check.set(true);
        }
        expired
    })));
    let context = Context::full(&runtime).map_err(|error| error.to_string())?;
    let mut controller: Option<Persistent<Object<'static>>> = None;
    let mut activation = String::new();
    let mut operation: Option<Operation> = None;
    let mut last_seq = 0_u64;
    let mut work_cpu = Duration::ZERO;

    loop {
        // Every entry into JS, including promise jobs and serialization, has a fresh CPU slice.
        deadline.set(Instant::now() + SLICE);
        let started = Instant::now();
        let job = runtime.execute_pending_job();
        let elapsed = started.elapsed();
        work_cpu += elapsed;
        if let Some(op) = &mut operation {
            op.cpu += elapsed;
        }
        if interrupted.get()
            || work_cpu > CPU_BUDGET
            || operation.as_ref().is_some_and(|op| op.cpu > CPU_BUDGET)
        {
            if let Some(op) = &operation {
                reply(&op.id, Err("QuickJS execution exceeded CPU budget".into()))?;
            }
            return Err("QuickJS execution exceeded CPU budget".into());
        }
        let had_job = match job {
            Ok(pending) => pending,
            Err(error) => {
                let message = error
                    .0
                    .with(|ctx| js_error(&ctx, rquickjs::Error::Exception));
                if let Some(op) = &operation {
                    reply(&op.id, Err(message.clone()))?;
                }
                return Err(message);
            }
        };
        if let Some(op) = &operation {
            deadline.set(Instant::now() + SLICE);
            let result = context.with(|ctx| -> Result<Option<Value>, String> {
                let promise = op
                    .promise
                    .clone()
                    .restore(&ctx)
                    .map_err(|error| js_error(&ctx, error))?;
                let Some(result) = promise.result::<JsValue>() else {
                    return Ok(None);
                };
                let value = result.map_err(|error| js_error(&ctx, error))?;
                let string = ctx
                    .json_stringify(value)
                    .map_err(|error| js_error(&ctx, error))?;
                Ok(Some(match string {
                    Some(string) => {
                        serde_json::from_str(&string.to_string().map_err(|e| e.to_string())?)
                            .map_err(|e| e.to_string())?
                    }
                    None => Value::Null,
                }))
            });
            match result {
                Ok(Some(value)) => {
                    reply(&op.id, Ok(value))?;
                    if op.dispose {
                        output(
                            json!({"type":"disposed","activationHandle":activation,"remainingLeaseIds":[]}),
                        )?;
                        return Ok(());
                    }
                    operation = None;
                }
                Err(error) => {
                    reply(&op.id, Err(error.clone()))?;
                    return Err(error);
                }
                _ => {}
            }
        }
        if operation
            .as_ref()
            .is_some_and(|op| Instant::now() >= op.deadline)
        {
            let op = operation.as_ref().unwrap();
            reply(&op.id, Err("QuickJS request exceeded 30 seconds".into()))?;
            return Err("QuickJS request timeout".into());
        }
        let wait = if had_job {
            Duration::ZERO
        } else if let Some(op) = &operation {
            op.deadline.saturating_duration_since(Instant::now())
        } else {
            Duration::from_secs(3600)
        };
        let frame = match rx.recv_timeout(wait) {
            Ok(frame) => frame?,
            Err(mpsc::RecvTimeoutError::Timeout) => {
                if !had_job {
                    work_cpu = Duration::ZERO;
                }
                continue;
            }
            Err(_) => return Ok(()),
        };
        if !had_job {
            work_cpu = Duration::ZERO;
        }
        if frame["type"] == "cancel" {
            return Ok(());
        }
        let id = frame["id"].as_str().unwrap_or("dispose").to_string();
        if frame["type"] != "reply" && operation.is_some() && frame["type"] != "dispose" {
            output(
                json!({"type":"reply","id":id,"result":{"ok":false,"requestId":id,"error":{"code":"RESOURCE_BUSY","message":"extension is busy","retryable":true}}}),
            )?;
            continue;
        }
        if !activation.is_empty()
            && frame["type"] != "reply"
            && frame["activationHandle"] != activation
        {
            return Err("activation mismatch".into());
        }
        deadline.set(Instant::now() + SLICE);
        let started = Instant::now();
        let handled = context.with(|ctx| -> Result<Option<Persistent<Promise<'static>>>,String> {
            let promise: Promise = match frame["type"].as_str() {
                Some("request") if frame["method"] == "activate" && controller.is_none() => {
                    activation = text(&frame,"activationHandle")?.to_string();
                    let source = text(&frame["params"],"source")?;
                    let manifest = frame["params"]["manifest"].clone();
                    let bound_activation = activation.clone();
                    let sequence = Cell::new(0_u64);
                    let send = Function::new(ctx.clone(), move |ctx: Ctx<'_>, payload: String| -> rquickjs::Result<()> {
                        if payload.len() > MAX_FRAME - 1024 { return Err(rquickjs::Exception::throw_type(&ctx,"message exceeds 1 MiB")); }
                        let data: Value = serde_json::from_str(&payload).map_err(|_| rquickjs::Exception::throw_type(&ctx,"invalid SDK message"))?;
                        let frame = if let Some(method) = data["method"].as_str() {
                            if !["project.read","git.status","storage.get","storage.set","settings.get"].contains(&method) { return Err(rquickjs::Exception::throw_type(&ctx,"SDK method denied")); }
                            json!({"type":"request","id":data["id"],"activationHandle":bound_activation,"method":method,"params":data["params"]})
                        } else {
                            sequence.set(sequence.get() + 1);
                            if sequence.get() > 100_000 { return Err(rquickjs::Exception::throw_type(&ctx,"event lifetime limit exceeded")); }
                            json!({"type":"event","activationHandle":bound_activation,"seq":sequence.get(),"event":data["event"],"data":data["data"]})
                        };
                        output(frame).map_err(|_| rquickjs::Exception::throw_type(&ctx,"host channel unavailable"))
                    }).map_err(|error|js_error(&ctx,error))?;
                    let factory: Function = ctx.eval(include_str!("bootstrap.js")).map_err(|error|js_error(&ctx,error))?;
                    let manifest_js = ctx.json_parse(manifest.to_string()).map_err(|error|js_error(&ctx,error))?;
                    let control: Object = factory.call((send, manifest_js)).map_err(|error|js_error(&ctx,error))?;
                    let module = Module::declare(ctx.clone(),"extension.mjs",source).map_err(|error|js_error(&ctx,error))?;
                    let (module,evaluated) = module.eval().map_err(|error|js_error(&ctx,error))?;
                    let activate: Function = control.get("activate").map_err(|error|js_error(&ctx,error))?;
                    let promise = activate.call((module.namespace().map_err(|error|js_error(&ctx,error))?,evaluated)).map_err(|error|js_error(&ctx,error))?;
                    controller = Some(Persistent::save(&ctx,control));
                    promise
                }
                Some("request") if frame["method"] == "execute" => {
                    let control = controller.as_ref().ok_or("extension not active")?.clone().restore(&ctx).map_err(|error|js_error(&ctx,error))?;
                    let execute: Function = control.get("execute").map_err(|error|js_error(&ctx,error))?;
                    execute.call((text(&frame["params"],"commandId")?,ctx.json_parse(frame["params"]["args"].to_string()).map_err(|error|js_error(&ctx,error))?)).map_err(|error|js_error(&ctx,error))?
                }
                Some("reply") => {
                    if frame["result"]["requestId"] != id { return Err("reply requestId mismatch".into()); }
                    let control = controller.as_ref().ok_or("extension not active")?.clone().restore(&ctx).map_err(|error|js_error(&ctx,error))?;
                    let receive: Function = control.get("reply").map_err(|error|js_error(&ctx,error))?;
                    receive.call::<_,()>((id.as_str(),ctx.json_parse(frame["result"].to_string()).map_err(|error|js_error(&ctx,error))?)).map_err(|error|js_error(&ctx,error))?;
                    return Ok(None);
                }
                Some("dispose") => {
                    let Some(control) = &controller else { return Err("extension not active".into()); };
                    let control = control.clone().restore(&ctx).map_err(|error|js_error(&ctx,error))?;
                    let dispose: Function = control.get("dispose").map_err(|error|js_error(&ctx,error))?;
                    dispose.call(()).map_err(|error|js_error(&ctx,error))?
                }
                _ => return Err("unsupported host control message".into()),
            };
            Ok(Some(Persistent::save(&ctx,promise)))
        });
        let elapsed = started.elapsed();
        if let Some(op) = &mut operation {
            op.cpu += elapsed;
        }
        match handled {
            Ok(Some(promise)) => {
                operation = Some(Operation {
                    id,
                    promise,
                    deadline: Instant::now() + REQUEST_TIMEOUT,
                    cpu: elapsed,
                    dispose: frame["type"] == "dispose",
                })
            }
            Ok(None) => {}
            Err(error) => {
                reply(&id, Err(error.clone()))?;
                return Err(error);
            }
        }
        last_seq += 1;
        if last_seq > 1_000_000 {
            return Err("host message lifetime limit exceeded".into());
        }
    }
}
fn main() {
    if let Err(error) = run() {
        eprintln!("horizon-extension-host: {error}");
        std::process::exit(1);
    }
}
