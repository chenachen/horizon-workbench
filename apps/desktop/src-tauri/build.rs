use std::{env, fs, path::Path};

fn collect_language_files(package: &Path, directory: &Path, entries: &mut Vec<String>) {
    let mut paths: Vec<_> = fs::read_dir(directory)
        .expect("read builtin language directory")
        .map(|entry| entry.expect("read builtin language entry").path())
        .collect();
    paths.sort();
    for path in paths {
        if path.is_dir() {
            collect_language_files(package, &path, entries);
        } else {
            let id = package.file_name().unwrap().to_str().unwrap();
            let relative = path
                .strip_prefix(package)
                .unwrap()
                .to_str()
                .unwrap()
                .replace('\\', "/");
            entries.push(format!(
                "({id:?}, {relative:?}, include_bytes!({path:?})),",
                path = path.to_str().unwrap(),
            ));
        }
    }
}

fn main() {
    let builtins = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../../packages/plugins/builtins");
    println!("cargo:rerun-if-changed={}", builtins.display());
    let mut packages: Vec<_> = fs::read_dir(&builtins)
        .expect("read builtin packages")
        .map(|entry| entry.expect("read builtin package").path())
        .filter(|path| {
            path.file_name()
                .unwrap()
                .to_string_lossy()
                .starts_with("horizon.language.")
                || path.file_name().unwrap().to_string_lossy().starts_with("horizon.semantic.")
        })
        .collect();
    packages.sort();
    let mut entries = Vec::new();
    for package in packages {
        collect_language_files(&package, &package, &mut entries);
    }
    let generated = format!(
        "const BUILTIN_LANGUAGE_FILES: &[(&str, &str, &[u8])] = &[\n{}\n];\n",
        entries.join("\n"),
    );
    fs::write(
        Path::new(&env::var("OUT_DIR").unwrap()).join("builtin_languages.rs"),
        generated,
    )
    .expect("write builtin language resources");
    tauri_build::build();
}
