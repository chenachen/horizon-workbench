use crate::{Call, HostError, HostState};
use base64::{engine::general_purpose::STANDARD, Engine};
use image::{ImageDecoder, ImageFormat, ImageReader};
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use sha2::{Digest, Sha256};
use std::{
    collections::HashMap,
    fs,
    io::Cursor,
    path::{Path, PathBuf},
    sync::{Arc, Mutex, OnceLock},
};
use tauri::{ipc::Channel, AppHandle, Emitter};

const GEOMETRY: &[(&str, f64, f64, f64)] = &[
    ("sidebarWidth", 240., 160., 480.),
    ("navigationWidth", 64., 48., 280.),
    ("topbarHeight", 56., 40., 88.),
    ("tabHeight", 40., 28., 64.),
    ("tabMinWidth", 120., 80., 240.),
    ("auxiliaryWidth", 320., 240., 560.),
    ("bottomHeight", 220., 120., 480.),
    ("statusHeight", 26., 20., 40.),
    ("uiFontSize", 13., 11., 20.),
    ("codeFontSize", 14., 10., 28.),
];
const TOKENS: &[&str] = &[
    "background",
    "surface",
    "text",
    "muted",
    "border",
    "accent",
    "onAccent",
    "selection",
    "success",
    "warning",
    "error",
];
static STORAGE_LOCK: Mutex<()> = Mutex::new(());
static PLANS: OnceLock<Mutex<HashMap<String, Plan>>> = OnceLock::new();
static WINDOW_GEOMETRY: OnceLock<Mutex<HashMap<String, Value>>> = OnceLock::new();
#[derive(Clone)]
struct Plan {
    revision: u64,
    target: String,
    digest: String,
    values: Value,
    preset: bool,
    packages: Vec<(String, String)>,
    ready: bool,
    created: std::time::Instant,
}
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Store {
    #[serde(default = "schema_version")]
    schema_version: u32,
    revision: u64,
    global: Map<String, Value>,
    projects: HashMap<String, Map<String, Value>>,
    presets: Vec<Value>,
    assets: Map<String, Value>,
}
impl Default for Store {
    fn default() -> Self {
        Self {
            schema_version: 2,
            revision: 0,
            global: Map::new(),
            projects: HashMap::new(),
            presets: vec![],
            assets: Map::new(),
        }
    }
}
fn schema_version() -> u32 {
    1
}
fn invalid(message: impl Into<String>) -> HostError {
    HostError::new("INVALID_ARGUMENT", message)
}
fn string<'a>(value: &'a Value, key: &str) -> Result<&'a str, HostError> {
    crate::protocol::string(value, key)
}
fn checked_revision(store: &Store, params: &Value) -> Result<(), HostError> {
    if params["expectedRevision"].as_u64() != Some(store.revision) {
        return Err(HostError::new("STALE_VERSION", "外观已更新，请刷新后重试"));
    }
    Ok(())
}
fn path(state: &HostState) -> PathBuf {
    state.data_dir().join("appearance.json")
}
fn load(state: &HostState) -> Result<Store, HostError> {
    let p = path(state);
    if !p.exists() {
        return Ok(Store::default());
    }
    let bytes = fs::read(&p)?;
    let mut store: Store = serde_json::from_slice(&bytes)?;
    if ![1, 2].contains(&store.schema_version) {
        return Err(HostError::new(
            "CONFIG_VERSION_UNSUPPORTED",
            "外观配置版本不受支持",
        ));
    }
    if store.schema_version == 1 {
        let active = state.registry.lock().unwrap().sessions.get("__app")
            .and_then(|session| session["activeProjectId"].as_str()).map(str::to_owned);
        migrate_global_appearance(&mut store, active.as_deref());
        let backup = state.data_dir().join("appearance-v1.backup.json");
        if !backup.exists() { fs::write(backup, bytes)?; }
        save(state, &mut store)?;
    }
    Ok(store)
}
fn migrate_global_appearance(store: &mut Store, active: Option<&str>) {
    if let Some(fields) = active.and_then(|id| store.projects.get(id)) {
        store.global.extend(fields.clone());
    }
    store.projects.clear();
    store.schema_version = 2;
}
fn save(state: &HostState, store: &mut Store) -> Result<(), HostError> {
    store.revision += 1;
    fs::create_dir_all(state.data_dir())?;
    let temp = state.data_dir().join("appearance.json.tmp");
    fs::write(&temp, serde_json::to_vec_pretty(store)?)?;
    fs::rename(temp, path(state))?;
    Ok(())
}
fn target(call: &Call, state: &HostState) -> Result<String, HostError> {
    let t = &call.params["target"];
    crate::protocol::allowed(t, &["kind", "projectId"])?;
    match t["kind"].as_str() {
        Some("global") if call.scope["kind"] == "app" => Ok("global".into()),
        Some("project") if call.method == "appearance_get" => {
            let id = string(t, "projectId")?;
            if call.scope["kind"] == "app" {
                state.project_root(id)?;
            } else if call.project_id()? != id {
                return Err(HostError::new("STALE_SCOPE", "设置目标与当前项目不匹配"));
            }
            Ok("global".into())
        }
        Some("project") => Err(invalid("外观仅支持全局设置")),
        _ => Err(invalid("无效设置范围")),
    }
}
fn background() -> Value {
    json!({"assetId":null,"region":"workbench","fit":"cover","position":{"x":0.5,"y":0.5},"opacity":0.12,"overlay":0.85})
}
fn defaults() -> Value {
    json!({"layoutId":"horizon.layout.mist","themeId":"horizon.theme.mist","mode":"system","geometryByLayout":{},"colorsByTheme":{},"background":background()})
}
fn source_fields(store: &Store, _target: &str) -> Map<String, Value> {
    store.global.clone()
}
fn overlay(prefs: &mut Value, fields: &Map<String, Value>) {
    for (key, value) in fields {
        let parts: Vec<_> = key.split(':').collect();
        match parts.as_slice() {
            ["geometry", layout, key] => {
                prefs["geometryByLayout"]
                    .as_object_mut()
                    .unwrap()
                    .entry((*layout).to_owned())
                    .or_insert(json!({}))[key] = value.clone();
            }
            ["color", theme, mode, token] => {
                let theme = prefs["colorsByTheme"]
                    .as_object_mut()
                    .unwrap()
                    .entry((*theme).to_owned())
                    .or_insert(json!({}));
                theme
                    .as_object_mut()
                    .unwrap()
                    .entry((*mode).to_owned())
                    .or_insert(json!({}))[token] = value.clone();
            }
            [key] => prefs[key] = value.clone(),
            _ => {}
        }
    }
}
fn field_from_key(key: &str) -> Value {
    let p: Vec<_> = key.split(':').collect();
    match p.as_slice() {
        ["geometry", layout, key] => json!({"kind":"geometry","layoutId":layout,"key":key}),
        ["color", theme, mode, token] => {
            json!({"kind":"color","themeId":theme,"mode":mode,"token":token})
        }
        _ => json!({"kind":key}),
    }
}
fn manifest_definition(state: &HostState, id: &str, kind: &str) -> Result<Value, HostError> {
    let owner = crate::extensions::contribution_owner(state, kind, id)?;
    let manifest = crate::extensions::manifest(state, &owner)?;
    manifest["contributes"][kind]
        .as_array()
        .and_then(|a| a.iter().find(|v| v["id"] == id))
        .cloned()
        .ok_or_else(|| HostError::new("NOT_FOUND", format!("资源 {id} 不存在")))
}
fn resource_gate(
    state: &HostState,
    id: &str,
    kind: &str,
    project: Option<&str>,
) -> Result<String, HostError> {
    let owner = crate::extensions::contribution_owner(state, kind, id)?;
    crate::extensions::extension_gate(state, &owner, project)?;
    Ok(owner)
}
fn snapshot(
    state: &HostState,
    store: &Store,
    target: &str,
    geometry: &Value,
) -> Result<Value, HostError> {
    let geometry = if geometry.is_null() {
        WINDOW_GEOMETRY
            .get_or_init(Default::default)
            .lock()
            .unwrap()
            .get(target)
            .cloned()
            .unwrap_or(Value::Null)
    } else {
        geometry.clone()
    };
    let fields = source_fields(store, target);
    let mut prefs = defaults();
    overlay(&mut prefs, &fields);
    let mut notices = vec![];
    for (key, kind) in [("layoutId", "layouts"), ("themeId", "themes")] {
        let id = string(&prefs, key)?.to_owned();
        if resource_gate(state, &id, kind, None).is_err()
            || manifest_definition(state, &id, kind).is_err()
        {
            notices.push(json!({"code":"EXTENSION_UNAVAILABLE","message":format!("{id} 不可用，当前使用内置恢复外观。可在插件中心恢复后重新选择。") }));
            prefs[key] = json!(if key == "layoutId" {
                "horizon.layout.mist"
            } else {
                "horizon.theme.mist"
            });
        }
    }
    let layout_id = string(&prefs, "layoutId")?.to_owned();
    let layout = manifest_definition(state, &layout_id, "layouts").unwrap_or_else(|_| {
        serde_json::from_str::<Value>(include_str!(
            "../../../../packages/plugins/builtins/horizon.layout.mist/manifest.json"
        ))
        .unwrap()["contributes"]["layouts"][0]
            .clone()
    });
    let mut preferred = Map::new();
    for (key, default, _, _) in GEOMETRY {
        if let Some(rule) = layout["geometry"].get(key) {
            preferred.insert(
                (*key).into(),
                prefs["geometryByLayout"][&layout_id]
                    .get(key)
                    .cloned()
                    .unwrap_or_else(|| rule.get("initial").cloned().unwrap_or(json!(default))),
            );
        }
    }
    prefs["geometryByLayout"]
        .as_object_mut()
        .unwrap()
        .insert(layout_id.to_owned(), Value::Object(preferred.clone()));
    let width = geometry["width"].as_f64().unwrap_or(1440.);
    let mut effective = preferred;
    if let Some(sidebar) = effective.get("sidebarWidth").and_then(Value::as_f64) {
        let navigation = effective
            .get("navigationWidth")
            .and_then(Value::as_f64)
            .unwrap_or(0.);
        effective.insert(
            "sidebarWidth".into(),
            json!(sidebar.min((width - navigation - 320.).max(160.))),
        );
    }
    let height = geometry["height"].as_f64().unwrap_or(900.);
    if let Some(bottom) = effective.get("bottomHeight").and_then(Value::as_f64) {
        effective.insert(
            "bottomHeight".into(),
            json!(bottom.min((height - 240.).max(120.))),
        );
    }
    let sources:Vec<_>=fields.keys().map(|key|json!({"field":field_from_key(key),"source":"global"})).collect();
    let layout_source = if store.global.contains_key("layoutId") {
        "global"
    } else {
        "default"
    };
    Ok(
        json!({"revision":store.revision,"effective":prefs,"sources":sources,"layoutSource":layout_source,"effectiveGeometry":effective,"notices":notices}),
    )
}
fn normalize_color(input: &str) -> Result<String, HostError> {
    let s = input.trim().to_lowercase();
    if s.starts_with('#')
        && (s.len() == 4 || s.len() == 7)
        && s[1..].chars().all(|c| c.is_ascii_hexdigit())
    {
        return Ok(if s.len() == 4 {
            format!(
                "#{}",
                s[1..].chars().flat_map(|c| [c, c]).collect::<String>()
            )
        } else {
            s
        });
    }
    if let Some(s) = s.strip_prefix("rgb(").and_then(|s| s.strip_suffix(')')) {
        let n: Result<Vec<u8>, _> = s.split(',').map(|n| n.trim().parse::<u8>()).collect();
        if let Ok(n) = n {
            if n.len() == 3 {
                return Ok(format!("#{:02x}{:02x}{:02x}", n[0], n[1], n[2]));
            }
        }
    }
    Err(invalid("颜色须为 HEX 或 RGB"))
}
fn validate_background(value: &Value) -> Result<(), HostError> {
    crate::protocol::allowed(
        value,
        &["assetId", "region", "fit", "position", "opacity", "overlay"],
    )?;
    if !value["assetId"].is_null()
        && !value["assetId"]
            .as_str()
            .is_some_and(|id| id.len() == 64 && id.chars().all(|c| c.is_ascii_hexdigit()))
    {
        return Err(invalid("图片引用无效"));
    }
    if !["workbench", "sidebar", "editor"].contains(&value["region"].as_str().unwrap_or(""))
        || !["cover", "contain"].contains(&value["fit"].as_str().unwrap_or(""))
    {
        return Err(invalid("图片显示方式无效"));
    }
    crate::protocol::allowed(&value["position"], &["x", "y"])?;
    for (v, min, max) in [
        (&value["position"]["x"], 0., 1.),
        (&value["position"]["y"], 0., 1.),
        (&value["opacity"], 0., 0.4),
        (&value["overlay"], 0.4, 1.),
    ] {
        if !v.as_f64().is_some_and(|n| n >= min && n <= max) {
            return Err(invalid("图片参数超出范围"));
        }
    }
    Ok(())
}
fn validate_change(
    state: &HostState,
    field: &Value,
    value: &Value,
) -> Result<(String, Value), HostError> {
    match string(field, "kind")? {
        "mode" => {
            crate::protocol::allowed(field, &["kind"])?;
            if !["system", "light", "dark"].contains(&value.as_str().unwrap_or("")) {
                return Err(invalid("明暗模式无效"));
            }
            Ok(("mode".into(), value.clone()))
        }
        "themeId" => {
            crate::protocol::allowed(field, &["kind"])?;
            let id = value.as_str().ok_or_else(|| invalid("主题无效"))?;
            manifest_definition(state, id, "themes")?;
            Ok(("themeId".into(), value.clone()))
        }
        "background" => {
            crate::protocol::allowed(field, &["kind"])?;
            validate_background(value)?;
            Ok(("background".into(), value.clone()))
        }
        "geometry" => {
            crate::protocol::allowed(field, &["kind", "layoutId", "key"])?;
            let layout = string(field, "layoutId")?;
            let key = string(field, "key")?;
            let (_, _, min, max) = GEOMETRY
                .iter()
                .find(|(k, _, _, _)| *k == key)
                .ok_or_else(|| invalid("未知尺寸"))?;
            let definition = manifest_definition(state, layout, "layouts")?;
            let rule = &definition["geometry"][key];
            let min = rule["min"].as_f64().unwrap_or(*min);
            let max = rule["max"].as_f64().unwrap_or(*max);
            if rule.is_null() || !value.as_f64().is_some_and(|n| n >= min && n <= max) {
                return Err(invalid("尺寸超出当前布局范围"));
            }
            Ok((format!("geometry:{layout}:{key}"), value.clone()))
        }
        "color" => {
            crate::protocol::allowed(field, &["kind", "themeId", "mode", "token"])?;
            let theme = string(field, "themeId")?;
            let mode = string(field, "mode")?;
            let token = string(field, "token")?;
            if !["light", "dark"].contains(&mode) || !TOKENS.contains(&token) {
                return Err(invalid("配色字段无效"));
            }
            manifest_definition(state, theme, "themes")?;
            Ok((
                format!("color:{theme}:{mode}:{token}"),
                json!(normalize_color(
                    value.as_str().ok_or_else(|| invalid("颜色无效"))?
                )?),
            ))
        }
        _ => Err(invalid("不支持的外观字段")),
    }
}
fn flatten_preferences(state: &HostState, prefs: &Value) -> Result<Map<String, Value>, HostError> {
    crate::protocol::allowed(
        prefs,
        &[
            "layoutId",
            "themeId",
            "mode",
            "geometryByLayout",
            "colorsByTheme",
            "background",
        ],
    )?;
    let mut result = Map::new();
    let layout = string(prefs, "layoutId")?;
    // Unknown packages remain named dependencies in imported drafts; geometry still uses public bounds.
    if !valid_id(layout) || !valid_id(string(prefs, "themeId")?) {
        return Err(invalid("包 ID 无效"));
    }
    result.insert("layoutId".into(), json!(layout));
    for key in ["mode", "background"] {
        let (key, value) = validate_change(state, &json!({"kind":key}), &prefs[key])?;
        result.insert(key, value);
    }
    result.insert("themeId".into(), prefs["themeId"].clone());
    for (layout, values) in prefs["geometryByLayout"]
        .as_object()
        .ok_or_else(|| invalid("尺寸必须为对象"))?
    {
        if !valid_id(layout) {
            return Err(invalid("布局 ID 无效"));
        }
        for (key, value) in values
            .as_object()
            .ok_or_else(|| invalid("尺寸必须为对象"))?
        {
            let (_, _, min, max) = GEOMETRY
                .iter()
                .find(|(k, _, _, _)| k == key)
                .ok_or_else(|| invalid("未知尺寸字段"))?;
            if !value.as_f64().is_some_and(|n| n >= *min && n <= *max) {
                return Err(invalid("尺寸超出范围"));
            }
            result.insert(format!("geometry:{layout}:{key}"), value.clone());
        }
    }
    for (theme, modes) in prefs["colorsByTheme"]
        .as_object()
        .ok_or_else(|| invalid("颜色必须为对象"))?
    {
        if !valid_id(theme) {
            return Err(invalid("主题 ID 无效"));
        }
        crate::protocol::allowed(modes, &["light", "dark"])?;
        for (mode, colors) in modes.as_object().unwrap() {
            for (token, color) in colors
                .as_object()
                .ok_or_else(|| invalid("颜色必须为对象"))?
            {
                if !TOKENS.contains(&token.as_str()) {
                    return Err(invalid("未知颜色令牌"));
                }
                result.insert(
                    format!("color:{theme}:{mode}:{token}"),
                    json!(normalize_color(
                        color.as_str().ok_or_else(|| invalid("颜色无效"))?
                    )?),
                );
            }
        }
    }
    Ok(result)
}
fn valid_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 160
        && id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_'))
}
fn make_preset(state: &HostState, name: &str, values: &Value) -> Result<Value, HostError> {
    let name = name.trim();
    if name.is_empty() || name.chars().count() > 48 {
        return Err(invalid("组合名称需为 1–48 个字符"));
    }
    let fields = flatten_preferences(state, values)?;
    let mut normalized = defaults();
    overlay(&mut normalized, &fields);
    let assets = normalized["background"]["assetId"]
        .as_str()
        .map(|id| vec![id])
        .unwrap_or_default();
    let mut package_refs = vec![];
    for (key, kind) in [("layoutId", "layouts"), ("themeId", "themes")] {
        let resource = string(&normalized, key)?;
        let owner = crate::extensions::contribution_owner(state, kind, resource)
            .unwrap_or_else(|_| resource.to_owned());
        if !package_refs
            .iter()
            .any(|reference: &Value| reference["id"] == owner)
        {
            package_refs.push(json!({"id":owner,"apiVersion":1}));
        }
    }
    Ok(
        json!({"id":uuid::Uuid::new_v4().to_string(),"revision":1,"name":name,"packageRefs":package_refs,"assetRefs":assets,"values":normalized}),
    )
}
fn target_fields<'a>(store: &'a mut Store, target: &str) -> &'a mut Map<String, Value> {
    if target == "global" {
        &mut store.global
    } else {
        store.projects.entry(target.into()).or_default()
    }
}
fn asset_path(state: &HostState, id: &str) -> Result<PathBuf, HostError> {
    if id.len() != 64 || !id.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err(invalid("图片引用无效"));
    }
    Ok(state
        .data_dir()
        .join("appearance-assets")
        .join(format!("{id}.png")))
}
fn import_progress(
    state: &HostState,
    request: Option<&str>,
    phase: &str,
    completed: u8,
) -> Result<(), HostError> {
    if let Some(request) = request {
        if state.is_cancelled(request) {
            return Err(HostError::new("CANCELLED", "图片导入已取消"));
        }
        let _ = state.emit_task(
            request,
            json!({"type":"progress","phase":phase,"completed":completed,"total":100}),
        );
    }
    Ok(())
}
fn import_image(state: &HostState, path: &Path, request: Option<&str>) -> Result<Value, HostError> {
    import_progress(state, request, "读取图片", 5)?;
    if fs::metadata(path)?.len() > 20 * 1024 * 1024 {
        return Err(HostError::new("IMAGE_TOO_LARGE", "图片不可超过 20 MiB"));
    }
    let bytes = fs::read(path)?;
    let format = image::guess_format(&bytes)
        .map_err(|_| HostError::new("IMAGE_UNSUPPORTED", "请选择 PNG、JPEG 或 WebP"))?;
    let decode_error =
        |error: image::ImageError| HostError::new("IMAGE_DECODE_FAILED", error.to_string());
    let animated = match format {
        ImageFormat::Png => image::codecs::png::PngDecoder::new(Cursor::new(&bytes))
            .map_err(decode_error)?
            .is_apng()
            .map_err(decode_error)?,
        ImageFormat::WebP => image::codecs::webp::WebPDecoder::new(Cursor::new(&bytes))
            .map_err(decode_error)?
            .has_animation(),
        ImageFormat::Jpeg => false,
        _ => true,
    };
    if animated {
        return Err(HostError::new(
            "IMAGE_UNSUPPORTED",
            "仅支持静态 PNG、JPEG 或 WebP",
        ));
    }
    let reader = ImageReader::with_format(Cursor::new(&bytes), format);
    let (w, h) = ImageReader::with_format(Cursor::new(&bytes), format)
        .into_dimensions()
        .map_err(|e| HostError::new("IMAGE_DECODE_FAILED", e.to_string()))?;
    if u64::from(w) * u64::from(h) > 40_000_000 {
        return Err(HostError::new(
            "IMAGE_TOO_LARGE",
            "图片不可超过 4000 万像素",
        ));
    }
    let mut decoder = reader
        .into_decoder()
        .map_err(|e| HostError::new("IMAGE_DECODE_FAILED", e.to_string()))?;
    let orientation = decoder
        .orientation()
        .map_err(|e| HostError::new("IMAGE_DECODE_FAILED", e.to_string()))?;
    let mut image = image::DynamicImage::from_decoder(decoder)
        .map_err(|e| HostError::new("IMAGE_DECODE_FAILED", e.to_string()))?;
    image.apply_orientation(orientation);
    import_progress(state, request, "调整图片尺寸", 45)?;
    let image = if image.width() > 2560 || image.height() > 2560 {
        image.resize(2560, 2560, image::imageops::FilterType::Lanczos3)
    } else {
        image
    };
    let mut encoded = Cursor::new(Vec::new());
    image
        .write_to(&mut encoded, ImageFormat::Png)
        .map_err(|e| HostError::new("IMAGE_DECODE_FAILED", e.to_string()))?;
    let bytes = encoded.into_inner();
    import_progress(state, request, "保存本机资产", 90)?;
    let id = format!("{:x}", Sha256::digest(&bytes));
    let path = asset_path(state, &id)?;
    fs::create_dir_all(path.parent().unwrap())?;
    fs::write(&path, &bytes)?;
    let thumb = path.with_file_name(format!("{id}-preview.png"));
    image
        .thumbnail(480, 480)
        .save_with_format(thumb, ImageFormat::Png)
        .map_err(|e| HostError::new("IO_ERROR", e.to_string()))?;
    Ok(
        json!({"id":id,"revision":1,"contentHash":id,"mediaType":"image/png","width":image.width(),"height":image.height(),"bytes":bytes.len().to_string(),"previewToken":id}),
    )
}
fn changed(app: &AppHandle, store: &Store, target: &str) {
    let _ = app.emit(
        "appearance:changed",
        json!({"revision":store.revision,"target":target}),
    );
}

pub async fn dispatch(
    state: Arc<HostState>,
    app: AppHandle,
    call: Call,
    _channel: Option<Channel<Value>>,
) -> Result<Value, HostError> {
    let params = &call.params;
    let allowed_fields: &[&str] = match call.method.as_str() {
        "appearance_get" => &["target", "windowGeometry"],
        "appearance_patch" => &["target", "expectedRevision", "changes"],
        "appearance_layout_prepare" => &["target", "expectedRevision", "layoutId"],
        "appearance_preset_prepare" => &["target", "expectedRevision", "presetId"],
        "appearance_layout_apply" | "appearance_preset_apply" => &["planId", "digest"],
        "appearance_background_pick" | "appearance_preset_list" => &[],
        "appearance_background_import" | "appearance_preset_import" => &["selectionToken"],
        "appearance_background_read" => &["previewToken", "thumbnail"],
        "appearance_background_remove" => &["assetId", "expectedRevision"],
        "appearance_preset_pick" => &["purpose"],
        "appearance_preset_save" => &["id", "expectedRevision", "name", "values"],
        "appearance_preset_delete" => &["id", "expectedRevision"],
        "appearance_preset_export" => {
            &["presetId", "includeBackground", "destinationSelectionToken"]
        }
        _ => return Err(HostError::new("NOT_FOUND", "未知外观方法")),
    };
    crate::protocol::allowed(params, allowed_fields)?;
    if call.method == "appearance_preset_pick"
        && !matches!(params["purpose"].as_str(), Some("import" | "export"))
    {
        return Err(invalid("请选择导入或导出"));
    }
    if call.method == "appearance_get" {
        crate::protocol::allowed(&params["windowGeometry"], &["width", "height", "scale"])?;
        for key in ["width", "height", "scale"] {
            if !params["windowGeometry"][key]
                .as_f64()
                .is_some_and(|n| n > 0.)
            {
                return Err(invalid("窗口尺寸无效"));
            }
        }
    }
    if matches!(
        call.method.as_str(),
        "appearance_background_pick" | "appearance_preset_pick"
    ) {
        let request = if call.method == "appearance_background_pick" {
            crate::picker::Request::file().filter("静态图片", &["png", "jpg", "jpeg", "webp"])
        } else if params["purpose"] == "export" {
            crate::picker::Request::save("horizon-appearance.json").filter("Horizon 外观组合", &["json"])
        } else {
            crate::picker::Request::file().filter("Horizon 外观组合", &["json"])
        };
        let selected = crate::picker::pick(&app, &call, request).await?;
        let token = selected.map(|path| state.register_selection(path));
        return Ok(json!({"selectionToken":token}));
    }
    if call.method == "appearance_background_import" {
        let source = state.resolve_selection(string(params, "selectionToken")?)?;
        let s = state.clone();
        let request = call.request_id.clone();
        let asset =
            tauri::async_runtime::spawn_blocking(move || import_image(&s, &source, Some(&request)))
                .await
                .map_err(|e| HostError::new("IO_ERROR", e.to_string()))??;
        let _lock = STORAGE_LOCK.lock().unwrap();
        let mut store = load(&state)?;
        store
            .assets
            .insert(string(&asset, "id")?.into(), asset.clone());
        save(&state, &mut store)?;
        return Ok(asset);
    }
    tauri::async_runtime::spawn_blocking(move || dispatch_sync(state, app, call))
        .await
        .map_err(|error| HostError::new("IO_ERROR", error.to_string()))?
}
fn dispatch_sync(state: Arc<HostState>, app: AppHandle, call: Call) -> Result<Value, HostError> {
    let params = &call.params;
    let _lock = STORAGE_LOCK.lock().unwrap();
    let mut store = load(&state)?;
    match call.method.as_str() {
        "appearance_get" => {
            let target = target(&call, &state)?;
            WINDOW_GEOMETRY
                .get_or_init(Default::default)
                .lock()
                .unwrap()
                .insert(target.clone(), params["windowGeometry"].clone());
            snapshot(&state, &store, &target, &params["windowGeometry"])
        }
        "appearance_patch" => {
            let target = target(&call, &state)?;
            checked_revision(&store, params)?;
            let changes = params["changes"]
                .as_array()
                .filter(|a| a.len() <= 128)
                .ok_or_else(|| invalid("变更列表无效"))?;
            let mut edits = vec![];
            for change in changes {
                crate::protocol::allowed(change, &["field", "operation", "value"])?;
                let field = &change["field"];
                let operation = string(change, "operation")?;
                let default = match field["kind"].as_str() {
                    Some("mode") => json!("system"),
                    Some("themeId") => json!("horizon.theme.mist"),
                    Some("background") => background(),
                    Some("geometry") => {
                        let id = string(field, "layoutId")?;
                        manifest_definition(&state, id, "layouts")?["geometry"]
                            [string(field, "key")?]["initial"]
                            .clone()
                    }
                    Some("color") => json!("#000000"),
                    _ => return Err(invalid("未知外观字段")),
                };
                let (key, value) = validate_change(
                    &state,
                    field,
                    if operation == "unset" {
                        &default
                    } else {
                        &change["value"]
                    },
                )?;
                if operation == "set" {
                    if key == "themeId" {
                        resource_gate(
                            &state,
                            value.as_str().unwrap(),
                            "themes",
                            if target == "global" {
                                None
                            } else {
                                Some(&target)
                            },
                        )?;
                    }
                    if key == "background" {
                        if let Some(id) = value["assetId"].as_str() {
                            if !store.assets.contains_key(id) {
                                return Err(HostError::new("NOT_FOUND", "背景图片不存在"));
                            }
                        }
                    }
                } else if operation != "unset" {
                    return Err(invalid("未知外观操作"));
                }
                edits.push((
                    key,
                    if operation == "unset" {
                        None
                    } else {
                        Some(value)
                    },
                ));
            }
            for (key, value) in edits {
                let fields = target_fields(&mut store, &target);
                if let Some(value) = value {
                    fields.insert(key, value);
                } else {
                    fields.remove(&key);
                }
            }
            save(&state, &mut store)?;
            changed(&app, &store, &target);
            snapshot(&state, &store, &target, &Value::Null)
        }
        "appearance_layout_prepare" | "appearance_preset_prepare" => {
            let target = target(&call, &state)?;
            checked_revision(&store, params)?;
            let preset = call.method == "appearance_preset_prepare";
            let values = if preset {
                store
                    .presets
                    .iter()
                    .find(|p| p["id"] == params["presetId"])
                    .ok_or_else(|| HostError::new("NOT_FOUND", "组合不存在"))?["values"]
                    .clone()
            } else {
                json!({"layoutId":params["layoutId"]})
            };
            let next_id = values["layoutId"].as_str().unwrap_or_else(|| {
                if target != "global" {
                    store
                        .global
                        .get("layoutId")
                        .and_then(Value::as_str)
                        .unwrap_or("horizon.layout.mist")
                } else {
                    "horizon.layout.mist"
                }
            });
            let mut missing_packages = vec![];
            let mut missing_assets = vec![];
            let mut packages = vec![];
            for id in [
                Some(next_id),
                if preset {
                    values["themeId"].as_str()
                } else {
                    None
                },
            ]
            .into_iter()
            .flatten()
            {
                let kind = if id == next_id { "layouts" } else { "themes" };
                let owner = resource_gate(
                    &state,
                    id,
                    kind,
                    if target == "global" {
                        None
                    } else {
                        Some(&target)
                    },
                );
                if let Err(error) = owner {
                    if !preset {
                        return Err(error);
                    }
                    missing_packages.push(id.to_owned());
                } else {
                    manifest_definition(
                        &state,
                        id,
                        if id == next_id { "layouts" } else { "themes" },
                    )?;
                    let owner = owner.unwrap();
                    let manifest = crate::extensions::manifest(&state, &owner)?;
                    packages.push((
                        owner,
                        format!("{:x}", Sha256::digest(serde_json::to_vec(&manifest)?)),
                    ));
                }
            }
            if let Some(id) = values["background"]["assetId"].as_str() {
                if !store.assets.contains_key(id) {
                    missing_assets.push(id.to_owned());
                }
            }
            let from =
                snapshot(&state, &store, &target, &Value::Null)?["effective"]["layoutId"].clone();
            let next = next_id.to_owned();
            let plan_id = uuid::Uuid::new_v4().to_string();
            let digest = format!("{:x}", Sha256::digest(serde_json::to_vec(&values)?));
            let plan = Plan {
                revision: store.revision,
                target,
                digest: digest.clone(),
                values,
                preset,
                packages,
                ready: missing_packages.is_empty() && missing_assets.is_empty(),
                created: std::time::Instant::now(),
            };
            let mut plans = PLANS.get_or_init(Default::default).lock().unwrap();
            if plans.len() > 128 {
                plans.clear();
            }
            plans.insert(plan_id.clone(), plan);
            if preset {
                Ok(
                    json!({"planId":plan_id,"digest":digest,"missingPackages":missing_packages,"missingAssets":missing_assets}),
                )
            } else {
                Ok(
                    json!({"planId":plan_id,"digest":digest,"fromLayoutId":from,"toLayoutId":next,"requiredSlots":["editor"],"waitingForComposition":false}),
                )
            }
        }
        "appearance_layout_apply" | "appearance_preset_apply" => {
            let mut plans = PLANS.get_or_init(Default::default).lock().unwrap();
            let plan = plans
                .get(string(params, "planId")?)
                .cloned()
                .ok_or_else(|| HostError::new("STALE_VERSION", "切换计划已过期"))?;
            if plan.digest != string(params, "digest")?
                || plan.revision != store.revision
                || plan.created.elapsed().as_secs() > 300
            {
                return Err(HostError::new("STALE_VERSION", "外观已更新，请重新选择"));
            }
            if plan.preset != (call.method == "appearance_preset_apply") {
                return Err(invalid("切换计划类型不匹配"));
            }
            if !plan.ready {
                return Err(HostError::new(
                    "NOT_FOUND",
                    "组合依赖不完整，请处理后重新预检",
                ));
            }
            if (plan.target == "global" && call.scope["kind"] != "app")
                || (plan.target != "global" && call.project_id()? != plan.target)
            {
                return Err(HostError::new("STALE_SCOPE", "设置范围已改变"));
            }
            let project = if plan.target == "global" {
                None
            } else {
                Some(plan.target.as_str())
            };
            for (id, fingerprint) in &plan.packages {
                crate::extensions::extension_gate(&state, id, project)?;
                let manifest = crate::extensions::manifest(&state, id)?;
                if format!("{:x}", Sha256::digest(serde_json::to_vec(&manifest)?)) != *fingerprint {
                    return Err(HostError::new(
                        "STALE_VERSION",
                        "布局或主题包已更新，请重新选择",
                    ));
                }
            }
            if plan.preset {
                if let Some(id) = plan.values["background"]["assetId"].as_str() {
                    if !store.assets.contains_key(id) {
                        return Err(HostError::new("NOT_FOUND", "组合背景图片缺失"));
                    }
                }
                let layout = string(&plan.values, "layoutId")?;
                if let Some(geometry) = plan.values["geometryByLayout"][layout].as_object() {
                    for (key, value) in geometry {
                        validate_change(
                            &state,
                            &json!({"kind":"geometry","layoutId":layout,"key":key}),
                            value,
                        )?;
                    }
                }
                let fields = flatten_preferences(&state, &plan.values)?;
                target_fields(&mut store, &plan.target).extend(fields);
            } else if plan.values["layoutId"].is_null() {
                target_fields(&mut store, &plan.target).remove("layoutId");
            } else {
                target_fields(&mut store, &plan.target)
                    .insert("layoutId".into(), plan.values["layoutId"].clone());
            }
            save(&state, &mut store)?;
            plans.remove(string(params, "planId")?);
            changed(&app, &store, &plan.target);
            let snap = snapshot(&state, &store, &plan.target, &Value::Null)?;
            if plan.preset {
                Ok(snap)
            } else {
                Ok(json!({"status":"applied","snapshot":snap}))
            }
        }
        "appearance_background_read" => {
            let id = string(params, "previewToken")?;
            if !store.assets.contains_key(id) {
                return Err(HostError::new("NOT_FOUND", "背景图片缺失，请重新选择"));
            }
            let path = asset_path(&state, id)?;
            let thumbnail = path.with_file_name(format!("{id}-preview.png"));
            let bytes = fs::read(if params["thumbnail"] == true && thumbnail.exists() {
                thumbnail
            } else {
                path
            })?;
            Ok(json!({"dataUrl":format!("data:image/png;base64,{}",STANDARD.encode(bytes))}))
        }
        "appearance_background_remove" => {
            let id = string(params, "assetId")?;
            let asset = store
                .assets
                .get(id)
                .ok_or_else(|| HostError::new("NOT_FOUND", "图片不存在"))?;
            if asset["revision"] != params["expectedRevision"] {
                return Err(HostError::new("STALE_VERSION", "图片记录已更新"));
            }
            let mut references = vec![];
            if store
                .global
                .get("background")
                .is_some_and(|b| b["assetId"] == id)
            {
                references.push("global".to_string());
            }
            for (key, fields) in &store.projects {
                if fields.get("background").is_some_and(|b| b["assetId"] == id) {
                    references.push(key.clone());
                }
            }
            for preset in &store.presets {
                if preset["values"]["background"]["assetId"] == id {
                    references.push(preset["id"].as_str().unwrap_or("").into());
                }
            }
            if !references.is_empty() {
                return Err(HostError::new("RESOURCE_BUSY", "图片仍被配置或组合引用")
                    .details(json!({"references":references})));
            }
            let path = asset_path(&state, id)?;
            if path.exists() {
                fs::remove_file(&path)?;
            }
            let thumb = path.with_file_name(format!("{id}-preview.png"));
            if thumb.exists() {
                fs::remove_file(thumb)?;
            }
            store.assets.remove(id);
            save(&state, &mut store)?;
            Ok(json!({"removed":true,"references":[]}))
        }
        "appearance_preset_list" => Ok(json!({"items":store.presets})),
        "appearance_preset_save" => {
            let mut preset = make_preset(&state, string(params, "name")?, &params["values"])?;
            if let Some(id) = params["id"].as_str() {
                let old = store
                    .presets
                    .iter_mut()
                    .find(|p| p["id"] == id)
                    .ok_or_else(|| HostError::new("NOT_FOUND", "组合不存在"))?;
                if old["revision"] != params["expectedRevision"] {
                    return Err(HostError::new("STALE_VERSION", "组合已更新"));
                }
                preset["id"] = json!(id);
                preset["revision"] = json!(old["revision"].as_u64().unwrap_or(0) + 1);
                *old = preset.clone();
            } else {
                store.presets.push(preset.clone());
            }
            save(&state, &mut store)?;
            Ok(preset)
        }
        "appearance_preset_delete" => {
            let id = string(params, "id")?;
            let old = store
                .presets
                .iter()
                .find(|p| p["id"] == id)
                .ok_or_else(|| HostError::new("NOT_FOUND", "组合不存在"))?;
            if old["revision"] != params["expectedRevision"] {
                return Err(HostError::new("STALE_VERSION", "组合已更新"));
            }
            store.presets.retain(|p| p["id"] != id);
            save(&state, &mut store)?;
            Ok(json!({"removedId":id}))
        }
        "appearance_preset_export" => {
            let preset = store
                .presets
                .iter()
                .find(|p| p["id"] == params["presetId"])
                .ok_or_else(|| HostError::new("NOT_FOUND", "组合不存在"))?;
            let destination =
                state.resolve_selection(string(params, "destinationSelectionToken")?)?;
            let mut values = preset["values"].clone();
            let mut assets = vec![];
            if params["includeBackground"] == true {
                if let Some(id) = values["background"]["assetId"].as_str() {
                    let data = fs::read(asset_path(&state, id)?)?;
                    assets.push(json!({"id":id,"sha256":format!("{:x}",Sha256::digest(&data)),"data":STANDARD.encode(data)}));
                }
            } else {
                values["background"]["assetId"] = Value::Null;
            }
            let output = json!({"schemaVersion":1,"name":preset["name"],"values":values,"packageRefs":preset["packageRefs"],"assets":assets});
            let bytes = serde_json::to_vec_pretty(&output)?;
            let count = bytes.len();
            if state.is_cancelled(&call.request_id) {
                return Err(HostError::new("CANCELLED", "组合导出已取消"));
            }
            fs::write(destination, bytes)?;
            Ok(json!({"exportId":uuid::Uuid::new_v4().to_string(),"bytes":count.to_string()}))
        }
        "appearance_preset_import" => {
            let path = state.resolve_selection(string(params, "selectionToken")?)?;
            if fs::metadata(&path)?.len() > 50 * 1024 * 1024 {
                return Err(HostError::new(
                    "RESOURCE_LIMIT",
                    "组合资源包不可超过 50 MiB",
                ));
            }
            let value: Value = serde_json::from_slice(&fs::read(path)?)?;
            crate::protocol::allowed(
                &value,
                &["schemaVersion", "name", "values", "packageRefs", "assets"],
            )?;
            if value["schemaVersion"] != 1 {
                return Err(HostError::new(
                    "CONFIG_VERSION_UNSUPPORTED",
                    "不支持的组合格式版本",
                ));
            }
            let mut preset = make_preset(&state, string(&value, "name")?, &value["values"])?;
            if let Some(refs) = value.get("packageRefs") {
                let refs = refs
                    .as_array()
                    .filter(|refs| !refs.is_empty() && refs.len() <= 2)
                    .ok_or_else(|| invalid("组合包引用无效"))?;
                for reference in refs {
                    crate::protocol::allowed(reference, &["id", "apiVersion"])?;
                    let id = string(reference, "id")?;
                    if !valid_id(id) || reference["apiVersion"] != 1 {
                        return Err(invalid("组合包引用版本无效"));
                    }
                    let mut matched = false;
                    for (key, kind) in [("layoutId", "layouts"), ("themeId", "themes")] {
                        let resource = string(&preset["values"], key)?;
                        if resource == id || resource.starts_with(&format!("{id}.")) {
                            matched = true;
                            if let Ok(owner) =
                                crate::extensions::contribution_owner(&state, kind, resource)
                            {
                                if owner != id {
                                    return Err(invalid("组合资源与包引用不匹配"));
                                }
                            }
                        }
                    }
                    if !matched {
                        return Err(invalid("组合包含未使用的包引用"));
                    }
                }
                for key in ["layoutId", "themeId"] {
                    let resource = string(&preset["values"], key)?;
                    if !refs.iter().any(|reference| {
                        reference["id"].as_str().is_some_and(|id| {
                            resource == id || resource.starts_with(&format!("{id}."))
                        })
                    }) {
                        return Err(invalid("组合包引用不完整"));
                    }
                }
                preset["packageRefs"] = json!(refs);
            }
            if let Some(assets) = value["assets"].as_array() {
                if assets.len() > 1 {
                    return Err(invalid("组合只允许一张背景图"));
                }
                for asset in assets {
                    crate::protocol::allowed(asset, &["id", "sha256", "data"])?;
                    let id = string(asset, "id")?;
                    let dest = asset_path(&state, id)?;
                    if preset["values"]["background"]["assetId"] != id {
                        return Err(invalid("未引用的图片资源"));
                    }
                    let bytes = STANDARD
                        .decode(string(asset, "data")?)
                        .map_err(|_| invalid("图片资源编码无效"))?;
                    let hash = format!("{:x}", Sha256::digest(&bytes));
                    if hash != id || asset["sha256"] != hash {
                        return Err(invalid("图片摘要不匹配"));
                    }
                    let (w, h) = ImageReader::with_format(Cursor::new(&bytes), ImageFormat::Png)
                        .into_dimensions()
                        .map_err(|_| invalid("图片资源无效"))?;
                    if w > 2560 || h > 2560 {
                        return Err(invalid("图片资源尺寸超限"));
                    }
                    if image::codecs::png::PngDecoder::new(Cursor::new(&bytes))
                        .map_err(|_| invalid("图片资源损坏"))?
                        .is_apng()
                        .map_err(|_| invalid("图片资源损坏"))?
                    {
                        return Err(invalid("组合不可包含动画图片"));
                    }
                    let image = image::load_from_memory_with_format(&bytes, ImageFormat::Png)
                        .map_err(|_| invalid("图片资源损坏"))?;
                    fs::create_dir_all(dest.parent().unwrap())?;
                    fs::write(&dest, &bytes)?;
                    image
                        .thumbnail(480, 480)
                        .save_with_format(
                            dest.with_file_name(format!("{id}-preview.png")),
                            ImageFormat::Png,
                        )
                        .map_err(|error| HostError::new("IO_ERROR", error.to_string()))?;
                    store.assets.insert(id.into(),json!({"id":id,"revision":1,"contentHash":id,"mediaType":"image/png","width":w,"height":h,"bytes":bytes.len().to_string(),"previewToken":id}));
                }
            } else if !value["assets"].is_null() {
                return Err(invalid("图片资源列表无效"));
            }
            let mut warnings = vec![];
            for (key, kind) in [("layoutId", "layouts"), ("themeId", "themes")] {
                let id = string(&preset["values"], key)?;
                if resource_gate(&state, id, kind, None).is_err() {
                    warnings.push(format!("{id} 尚未安装或启用，应用前需在插件中心处理"));
                }
            }
            if let Some(id) = preset["values"]["background"]["assetId"].as_str() {
                if !store.assets.contains_key(id) {
                    warnings.push("背景图片缺失，应用前需选择其他组合或重新导入资源包".into());
                }
            }
            store.presets.push(preset.clone());
            save(&state, &mut store)?;
            Ok(json!({"preset":preset,"warnings":warnings}))
        }
        _ => Err(HostError::new("NOT_FOUND", "未知外观方法")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn project_appearance_reads_do_not_require_live_epoch_but_writes_do() {
        let data = tempfile::tempdir().unwrap();
        let project_dir = tempfile::tempdir().unwrap();
        let state = HostState::new(data.path().into()).unwrap();
        let project = state.register_project(project_dir.path().into(), None, None).unwrap()["project"]["id"].as_str().unwrap().to_owned();
        let mut call = Call { protocol_version: 1, request_id: "appearance-read".into(), method: "appearance_get".into(), scope: json!({"kind":"app"}), params: json!({"target":{"kind":"project","projectId":project}}), idempotency_key: None };
        assert_eq!(target(&call, &state).unwrap(), "global");
        state.invalidate_project_scope(&project);
        assert_eq!(target(&call, &state).unwrap(), "global");
        call.method = "appearance_patch".into();
        assert!(target(&call, &state).is_err());
        call.method = "appearance_get".into();
        call.params["target"]["projectId"] = json!("missing-project");
        assert_eq!(target(&call, &state).unwrap_err().code, "NOT_FOUND");
    }
    #[test]
    fn migration_preserves_active_appearance_once_across_restart() {
        let dir = tempfile::tempdir().unwrap();
        let state = HostState::new(dir.path().into()).unwrap();
        state.registry.lock().unwrap().sessions.insert("__app".into(), json!({"activeProjectId":"a"}));
        let mut old = Store::default(); old.schema_version = 1;
        old.global.insert("themeId".into(), json!("horizon.theme.paper"));
        old.projects.insert("a".into(), serde_json::from_value(json!({"layoutId":"horizon.layout.iris","geometry:horizon.layout.iris:sidebarWidth":280})).unwrap());
        old.projects.insert("b".into(), serde_json::from_value(json!({"layoutId":"horizon.layout.orbit"})).unwrap());
        save(&state, &mut old).unwrap();
        let migrated = load(&state).unwrap();
        assert_eq!(migrated.schema_version, 2);
        assert_eq!(migrated.global["layoutId"], "horizon.layout.iris");
        assert_eq!(migrated.global["themeId"], "horizon.theme.paper");
        assert!(migrated.projects.is_empty());
        assert!(state.data_dir().join("appearance-v1.backup.json").exists());
        state.registry.lock().unwrap().sessions.insert("__app".into(), json!({"activeProjectId":"b"}));
        let reopened = load(&state).unwrap();
        assert_eq!(source_fields(&reopened,"a"),source_fields(&reopened,"b"));
        assert_eq!(reopened.global["layoutId"], "horizon.layout.iris");
        assert_eq!(reopened.revision,migrated.revision);
    }
    #[test]
    fn colors_are_normalized_and_css_payloads_rejected() {
        assert_eq!(normalize_color("#aBc").unwrap(), "#aabbcc");
        assert_eq!(normalize_color("rgb(0, 128, 255)").unwrap(), "#0080ff");
        assert!(normalize_color("url(file:///tmp/x)").is_err());
        assert!(normalize_color("rgb(300, 0, 0)").is_err());
    }
    #[test]
    fn project_fields_cannot_override_global_appearance() {
        let mut store = Store::default();
        store.global.insert(
            "geometry:horizon.layout.mist:codeFontSize".into(),
            json!(15),
        );
        store.global.insert("mode".into(), json!("dark"));
        store.projects.entry("a".into()).or_default().insert(
            "geometry:horizon.layout.mist:codeFontSize".into(),
            json!(16),
        );
        let mut prefs = defaults();
        overlay(&mut prefs, &source_fields(&store, "a"));
        assert_eq!(
            prefs["geometryByLayout"]["horizon.layout.mist"]["codeFontSize"],
            15
        );
        assert_eq!(prefs["mode"], "dark");
        store.projects.get_mut("a").unwrap().clear();
        let mut prefs = defaults();
        overlay(&mut prefs, &source_fields(&store, "a"));
        assert_eq!(
            prefs["geometryByLayout"]["horizon.layout.mist"]["codeFontSize"],
            15
        );
    }
    #[test]
    fn backgrounds_reject_remote_paths_and_out_of_range_values() {
        let mut bg = background();
        assert!(validate_background(&bg).is_ok());
        bg["opacity"] = json!(0.9);
        assert!(validate_background(&bg).is_err());
        assert!(!valid_id("../image"));
    }
    #[test]
    fn preferences_survive_restart_and_narrow_window_does_not_rewrite() {
        let dir = tempfile::tempdir().unwrap();
        let state = HostState::new(dir.path().into()).unwrap();
        let mut store = Store::default();
        store.global.insert(
            "geometry:horizon.layout.mist:sidebarWidth".into(),
            json!(480),
        );
        save(&state, &mut store).unwrap();
        let reopened = HostState::new(dir.path().into()).unwrap();
        let loaded = load(&reopened).unwrap();
        let small = snapshot(
            &reopened,
            &loaded,
            "global",
            &json!({"width":600,"height":700}),
        )
        .unwrap();
        assert_eq!(
            small["effective"]["geometryByLayout"]["horizon.layout.mist"]["sidebarWidth"],
            480
        );
        assert!(small["effectiveGeometry"]["sidebarWidth"].as_f64().unwrap() < 480.);
        let large = snapshot(
            &reopened,
            &loaded,
            "global",
            &json!({"width":1600,"height":900}),
        )
        .unwrap();
        assert_eq!(
            large["effectiveGeometry"]["sidebarWidth"].as_f64(),
            Some(480.)
        );
        assert!(checked_revision(&loaded, &json!({"expectedRevision":0})).is_err());
    }
    #[test]
    fn presets_reject_unknown_tokens_and_keep_missing_package_as_dependency() {
        let dir = tempfile::tempdir().unwrap();
        let state = HostState::new(dir.path().into()).unwrap();
        let mut values = defaults();
        values["layoutId"] = json!("example.layout.custom");
        let preset = make_preset(&state, "自定义", &values).unwrap();
        assert_eq!(preset["packageRefs"][0]["id"], "example.layout.custom");
        values["colorsByTheme"] = json!({"horizon.theme.mist":{"light":{"unknown":"#ffffff"}}});
        assert!(make_preset(&state, "无效", &values).is_err());
        values["colorsByTheme"] =
            json!({"horizon.theme.mist":{"light":{"accent":"url(https://example.com/image)"}}});
        assert!(make_preset(&state, "无效", &values).is_err());
    }
    #[test]
    fn imported_image_is_resized_deduplicated_and_independent_of_original() {
        let dir = tempfile::tempdir().unwrap();
        let state = HostState::new(dir.path().join("data")).unwrap();
        let source = dir.path().join("source.png");
        image::RgbImage::from_pixel(3000, 150, image::Rgb([10, 30, 80]))
            .save(&source)
            .unwrap();
        let a = import_image(&state, &source, None).unwrap();
        let b = import_image(&state, &source, None).unwrap();
        assert_eq!(a["id"], b["id"]);
        assert_eq!(a["width"], 2560);
        fs::remove_file(source).unwrap();
        let retained = asset_path(&state, a["id"].as_str().unwrap()).unwrap();
        assert!(retained.exists());
        assert_eq!(image::open(retained).unwrap().width(), 2560);
    }
    #[test]
    fn custom_resource_uses_owning_package_for_gates_and_preset_references() {
        let dir = tempfile::tempdir().unwrap();
        let state = HostState::new(dir.path().into()).unwrap();
        manifest_definition(&state, "horizon.layout.mist", "layouts").unwrap();
        let path = state.data_dir().join("extensions/registry.json");
        let mut registry: Value = serde_json::from_slice(&fs::read(&path).unwrap()).unwrap();
        let mut record = registry["records"]["horizon.layout.mist"].clone();
        record["manifest"]["id"] = json!("example.layout");
        record["manifest"]["contributes"]["layouts"][0]["id"] = json!("example.layout.wide");
        registry["records"]["example.layout"] = record;
        fs::write(path, serde_json::to_vec(&registry).unwrap()).unwrap();
        assert_eq!(
            resource_gate(&state, "example.layout.wide", "layouts", None).unwrap(),
            "example.layout"
        );
        assert_eq!(
            manifest_definition(&state, "example.layout.wide", "layouts").unwrap()["id"],
            "example.layout.wide"
        );
        let mut preferences = defaults();
        preferences["layoutId"] = json!("example.layout.wide");
        let preset = make_preset(&state, "布局组合", &preferences).unwrap();
        assert_eq!(preset["packageRefs"][0]["id"], "example.layout");
    }
}
