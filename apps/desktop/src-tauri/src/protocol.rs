use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Call {
    pub protocol_version: u32,
    pub request_id: String,
    pub method: String,
    pub scope: Value,
    pub params: Value,
    pub idempotency_key: Option<String>,
}

impl Call {
    pub fn project_id(&self) -> Result<&str, HostError> {
        self.scope.get("projectId").and_then(Value::as_str)
            .ok_or_else(|| HostError::new("INVALID_ARGUMENT", "此操作需要项目作用域"))
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HostError {
    pub code: String,
    pub message: String,
    pub retryable: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub operation_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub recovery: Option<Vec<String>>,
}

impl HostError {
    pub fn new(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {code:code.into(),message:message.into(),retryable:false,operation_id:None,details:None,recovery:None}
    }
    pub fn details(mut self, value: Value) -> Self { self.details = Some(value); self }
}
impl std::fmt::Display for HostError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result { write!(f, "{}: {}", self.code, self.message) }
}
impl std::error::Error for HostError {}
impl From<std::io::Error> for HostError {
    fn from(e: std::io::Error) -> Self {
        let code = match e.kind() {
            std::io::ErrorKind::NotFound => "NOT_FOUND",
            std::io::ErrorKind::PermissionDenied => "PERMISSION_DENIED",
            std::io::ErrorKind::AlreadyExists => "FILE_LOCKED",
            std::io::ErrorKind::StorageFull => "DISK_FULL",
            _ => "IO_ERROR",
        };
        Self::new(code, e.to_string())
    }
}
impl From<serde_json::Error> for HostError {
    fn from(e: serde_json::Error) -> Self { Self::new("INVALID_ARGUMENT",e.to_string()) }
}

pub fn reply(request_id: &str, result: Result<Value, HostError>) -> Value {
    match result {
        Ok(data) => json!({"ok":true,"requestId":request_id,"data":data}),
        Err(error) => json!({"ok":false,"requestId":request_id,"error":error}),
    }
}
pub fn string<'a>(v: &'a Value, key: &str) -> Result<&'a str, HostError> {
    v.get(key).and_then(Value::as_str).ok_or_else(|| HostError::new("INVALID_ARGUMENT",format!("缺少字段 {key}")))
}
pub fn revision(v: &Value, key: &str) -> Result<u64, HostError> {
    v.get(key).and_then(Value::as_u64).filter(|n| *n <= 9_007_199_254_740_991)
        .ok_or_else(|| HostError::new("INVALID_ARGUMENT",format!("无效版本 {key}")))
}
pub fn allowed(params: &Value, fields: &[&str]) -> Result<(), HostError> {
    let map = params.as_object().ok_or_else(|| HostError::new("INVALID_ARGUMENT","params 必须为对象"))?;
    if let Some(key) = map.keys().find(|key| !fields.contains(&key.as_str())) {
        return Err(HostError::new("INVALID_ARGUMENT",format!("未知字段 {key}")));
    }
    Ok(())
}
