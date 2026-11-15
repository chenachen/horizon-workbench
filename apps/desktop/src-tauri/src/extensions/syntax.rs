use super::{check_gate, err, io, read_registry, record, str_param};
use crate::{HostError, HostState};
use serde_json::Value;
use std::{collections::BTreeSet, fs, io::Read, path::Path};

fn language_id(value: &str) -> bool {
    value
        .as_bytes()
        .first()
        .is_some_and(u8::is_ascii_alphabetic)
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || b"_.+-".contains(&byte))
}

fn scope_name(value: &str) -> bool {
    value
        .as_bytes()
        .first()
        .is_some_and(|byte| byte.is_ascii_alphabetic() || *byte == b'_')
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || b"_.-".contains(&byte))
}

fn array_field<'a>(value: &'a Value, field: &str) -> Result<&'a [Value], HostError> {
    match value.get(field) {
        None => Ok(&[]),
        Some(items) => items
            .as_array()
            .map(Vec::as_slice)
            .ok_or_else(|| err("INVALID_ARGUMENT", format!("{field} 必须是数组"))),
    }
}

fn strings(value: &Value, field: &str, valid: impl Fn(&str) -> bool) -> Result<(), HostError> {
    for item in array_field(value, field)? {
        if !item.as_str().is_some_and(&valid) {
            return Err(err("INVALID_ARGUMENT", format!("{field} 包含无效值")));
        }
    }
    Ok(())
}

fn package_relative_path(value: &str) -> bool {
    !value.is_empty()
        && !value.contains(['\\', ':', '\0'])
        && value
            .split('/')
            .all(|part| !part.is_empty() && part != "." && part != "..")
        && !Path::new(value).is_absolute()
}

pub(super) fn validate_contributions(contributes: &Value) -> Result<(), HostError> {
    let mut languages = BTreeSet::new();
    for language in array_field(contributes, "languages")? {
        crate::protocol::allowed(language, &["id", "aliases", "extensions", "filenames"])?;
        let id = str_param(language, "id")?;
        if !language_id(id) || !languages.insert(id) {
            return Err(err("INVALID_ARGUMENT", "语言 ID 无效或重复"));
        }
        strings(language, "aliases", |name| !name.trim().is_empty())?;
        strings(language, "extensions", |extension| {
            extension.starts_with('.')
                && extension.len() > 1
                && !extension.contains(['/', '\\', '\0'])
        })?;
        strings(language, "filenames", |name| {
            !name.is_empty() && name != "." && name != ".." && !name.contains(['/', '\\', '\0'])
        })?;
    }
    let mut scopes = BTreeSet::new();
    for grammar in array_field(contributes, "grammars")? {
        crate::protocol::allowed(grammar, &["language", "scopeName", "path", "injectTo"])?;
        let scope = str_param(grammar, "scopeName")?;
        if !scope_name(scope) || !scopes.insert(scope) {
            return Err(err("INVALID_ARGUMENT", "语法 scopeName 无效或重复"));
        }
        if grammar
            .get("language")
            .is_some_and(|value| !value.as_str().is_some_and(language_id))
        {
            return Err(err("INVALID_ARGUMENT", "语法语言 ID 无效"));
        }
        let path = str_param(grammar, "path")?;
        if !package_relative_path(path) || !path.ends_with(".json") {
            return Err(err("INVALID_ARGUMENT", "语法资源必须是包内 JSON 文件"));
        }
        strings(grammar, "injectTo", scope_name)?;
    }
    Ok(())
}

pub(super) fn validate_token_colors(token_colors: Option<&Value>) -> Result<(), HostError> {
    let Some(token_colors) = token_colors else {
        return Ok(());
    };
    crate::protocol::allowed(token_colors, &["light", "dark"])?;
    for mode in ["light", "dark"] {
        for rule in array_field(token_colors, mode)? {
            crate::protocol::allowed(rule, &["name", "scope", "settings"])?;
            if rule.get("name").is_some_and(|name| !name.is_string()) {
                return Err(err("INVALID_ARGUMENT", "语法配色名称必须是字符串"));
            }
            let valid_scope =
                |value: &Value| value.as_str().is_some_and(|scope| !scope.trim().is_empty());
            let valid_scopes = match &rule["scope"] {
                Value::String(_) => valid_scope(&rule["scope"]),
                Value::Array(scopes) => !scopes.is_empty() && scopes.iter().all(valid_scope),
                _ => false,
            };
            if !valid_scopes {
                return Err(err("INVALID_ARGUMENT", "语法配色 scope 无效"));
            }
            let settings = &rule["settings"];
            crate::protocol::allowed(settings, &["foreground", "fontStyle"])?;
            if settings.get("foreground").is_some_and(|color| {
                !color.as_str().is_some_and(|color| {
                    color.len() == 7
                        && color.starts_with('#')
                        && color[1..].bytes().all(|byte| byte.is_ascii_hexdigit())
                })
            }) {
                return Err(err("INVALID_ARGUMENT", "语法配色必须使用六位 HEX 颜色"));
            }
            if settings.get("fontStyle").is_some_and(|style| {
                !style.as_str().is_some_and(|style| {
                    style.split_whitespace().all(|word| {
                        ["italic", "bold", "underline", "strikethrough"].contains(&word)
                    })
                })
            }) {
                return Err(err("INVALID_ARGUMENT", "语法字体样式无效"));
            }
        }
    }
    Ok(())
}

pub(super) fn validate_package_grammars(
    manifest: &Value,
    files: &[(std::path::PathBuf, Vec<u8>)],
) -> Result<(), HostError> {
    for grammar in array_field(&manifest["contributes"], "grammars")? {
        let relative = str_param(grammar, "path")?;
        let bytes = files
            .iter()
            .find(|(path, _)| path == Path::new(relative))
            .map(|(_, bytes)| bytes)
            .ok_or_else(|| err("INVALID_ARGUMENT", format!("缺少语法资源 {relative}")))?;
        parse_grammar(bytes, str_param(grammar, "scopeName")?)?;
    }
    Ok(())
}

fn parse_grammar(bytes: &[u8], scope: &str) -> Result<Value, HostError> {
    let grammar: Value = serde_json::from_slice(bytes)
        .map_err(|error| err("INVALID_ARGUMENT", format!("语法 JSON 无效: {error}")))?;
    if !grammar.is_object() || grammar["scopeName"] != scope {
        return Err(err("INVALID_ARGUMENT", "语法 scopeName 与声明不一致"));
    }
    Ok(grammar)
}

pub fn read_grammar(
    state: &HostState,
    extension_id: &str,
    scope: &str,
    project: Option<&str>,
) -> Result<Value, HostError> {
    let registry = read_registry(state)?;
    check_gate(&registry, extension_id, project, &mut BTreeSet::new())?;
    let package = record(&registry, extension_id)?;
    let declaration = array_field(&package["manifest"]["contributes"], "grammars")?
        .iter()
        .find(|grammar| grammar["scopeName"] == scope)
        .ok_or_else(|| err("NOT_FOUND", "扩展未声明此语法资源"))?;
    let relative = str_param(declaration, "path")?;
    if !package_relative_path(relative) {
        return Err(err("PERMISSION_DENIED", "语法资源路径必须位于扩展包内"));
    }
    let root = fs::canonicalize(str_param(package, "packageDir")?).map_err(io)?;
    if let Some(expected_digest) = package["packageDigest"].as_str() {
        let files = super::package_files(&root)?;
        if super::package_digest(&files) != expected_digest {
            return Err(err(
                "EXTENSION_FAILED",
                "已安装扩展内容已变化，请重新检查并安装",
            ));
        }
    }
    let path = fs::canonicalize(root.join(relative)).map_err(io)?;
    if !path.starts_with(&root) {
        return Err(err("PERMISSION_DENIED", "语法资源超出扩展包目录"));
    }
    let mut file = fs::File::open(path).map_err(io)?;
    if file.metadata().map_err(io)?.len() > 4 * 1024 * 1024 {
        return Err(err("RESOURCE_LIMIT", "语法资源超过 4 MiB"));
    }
    let mut bytes = Vec::new();
    file.by_ref()
        .take(4 * 1024 * 1024 + 1)
        .read_to_end(&mut bytes)
        .map_err(io)?;
    if bytes.len() > 4 * 1024 * 1024 {
        return Err(err("RESOURCE_LIMIT", "语法资源超过 4 MiB"));
    }
    parse_grammar(&bytes, scope)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn manifest() -> Value {
        json!({
            "id":"local.language", "name":"Example", "version":"0.1.0", "description":"Example language", "author":"Example",
            "apiVersion":1, "engines":{"horizon":">=0.1.0 <0.2.0"}, "runtime":{"kind":"declarative"},
            "activation":["onLanguage:example"], "requires":{}, "optional":{}, "capabilities":[],
            "contributes":{
                "languages":[{"id":"example", "extensions":[".example"], "filenames":["Examplefile"], "aliases":["Example"]}],
                "grammars":[{"language":"example", "scopeName":"source.example", "path":"syntaxes/example.tmLanguage.json"}]
            }
        })
    }

    #[test]
    fn declaration_validation_accepts_languages_grammars_and_legacy_manifests() {
        let mut value = manifest();
        super::super::validate_manifest(&value, false).unwrap();
        value["contributes"] = json!({});
        super::super::validate_manifest(&value, false).unwrap();
        value["contributes"] = json!({"grammars":[{"scopeName":"source.helper", "path":"syntaxes/helper.json", "injectTo":["source.example"]}]});
        super::super::validate_manifest(&value, false).unwrap();
    }

    #[test]
    fn shipped_language_manifests_support_builtin_restore_validation() {
        for manifest in super::super::builtin_manifests() {
            if manifest["contributes"].get("grammars").is_some() {
                super::super::validate_manifest(&manifest, true).unwrap();
            }
        }
    }

    #[test]
    fn declaration_validation_rejects_malformed_resources_and_duplicate_ids() {
        let value = manifest();
        for languages in [
            json!(null),
            json!({}),
            json!([{"id":"bad/id"}]),
            json!([{"id":"example"},{"id":"example"}]),
            json!([{"id":"example", "extensions":["example"]}]),
            json!([{"id":"example", "filenames":["../Examplefile"]}]),
        ] {
            let mut candidate = value.clone();
            candidate["contributes"]["languages"] = languages;
            assert!(super::super::validate_manifest(&candidate, false).is_err());
        }
        for path in [
            "../outside.json",
            "/outside.json",
            "syntaxes/../outside.json",
            "syntaxes\\outside.json",
            "C:/outside.json",
            "syntaxes//example.json",
            "syntaxes/example.js",
        ] {
            let mut candidate = value.clone();
            candidate["contributes"]["grammars"][0]["path"] = json!(path);
            assert!(
                super::super::validate_manifest(&candidate, false).is_err(),
                "{path}"
            );
        }
        let mut candidate = value.clone();
        candidate["contributes"]["grammars"] = json!([
            value["contributes"]["grammars"][0].clone(),
            value["contributes"]["grammars"][0].clone()
        ]);
        assert!(super::super::validate_manifest(&candidate, false).is_err());
    }

    #[test]
    fn theme_token_rules_accept_selectors_and_validate_styles() {
        let valid = json!({"light":[{"scope":["keyword", "entity.name.function"], "settings":{"foreground":"#123456", "fontStyle":"bold italic"}}], "dark":[{"scope":"comment", "settings":{"fontStyle":""}}]});
        validate_token_colors(Some(&valid)).unwrap();
        for invalid in [
            json!({"light":null}),
            json!({"light":[{"scope":[], "settings":{}}]}),
            json!({"light":[{"scope":"keyword", "settings":{"foreground":"red"}}]}),
            json!({"light":[{"scope":"keyword", "settings":{"fontStyle":"blinking"}}]}),
            json!({"unknown":[]}),
        ] {
            assert!(validate_token_colors(Some(&invalid)).is_err());
        }
    }

    #[test]
    fn installation_requires_valid_declared_grammar_files() {
        let value = manifest();
        assert!(validate_package_grammars(&value, &[]).is_err());
        let path = std::path::PathBuf::from("syntaxes/example.tmLanguage.json");
        let invalid = vec![(path.clone(), br#"{"scopeName":"source.other"}"#.to_vec())];
        assert!(validate_package_grammars(&value, &invalid).is_err());
        let valid = vec![(
            path,
            br#"{"scopeName":"source.example","patterns":[]}"#.to_vec(),
        )];
        validate_package_grammars(&value, &valid).unwrap();
    }

    #[test]
    fn installation_rejects_language_and_scope_collisions() {
        let value = manifest();
        let registry = json!({"records":{"local.existing":{"installed":true,"manifest":value}}});
        assert!(super::super::dependency_check(&registry, &value).is_err());
        let mut candidate = value.clone();
        candidate["contributes"]["languages"][0]["id"] = json!("another");
        assert!(super::super::dependency_check(&registry, &candidate).is_err());
        candidate["contributes"]["grammars"][0]["scopeName"] = json!("source.another");
        super::super::dependency_check(&registry, &candidate).unwrap();
    }
}
