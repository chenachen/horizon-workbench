#!/usr/bin/env python3
"""Archive locked npm/Cargo notices from installed sources; no package updates."""
import argparse
import collections
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import tomllib
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "licenses/third-party"
UPSTREAM = BASE / "upstream"
MANIFESTS = ["apps/desktop/src-tauri/Cargo.toml", "apps/git-service/Cargo.toml", "apps/extension-host/Cargo.toml"]
NPM_BINARY_PARENTS = {
    "@rolldown/binding-linux-x64-musl": "rolldown",
    "@rolldown/binding-linux-arm64-musl": "rolldown",
    "@rollup/rollup-linux-x64-musl": "rollup",
    "@rollup/rollup-linux-arm64-musl": "rollup",
    "@tauri-apps/cli-linux-x64-musl": "@tauri-apps/cli",
    "@tauri-apps/cli-linux-arm64-musl": "@tauri-apps/cli",
    "@esbuild/linux-x64": "esbuild",
    "@esbuild/linux-arm64": "esbuild",
    "@rollup/rollup-linux-x64-gnu": "rollup",
    "@rollup/rollup-linux-arm64-gnu": "rollup",
    "@rolldown/binding-linux-x64-gnu": "rolldown",
    "@rolldown/binding-linux-arm64-gnu": "rolldown",
    "@tauri-apps/cli-linux-x64-gnu": "@tauri-apps/cli",
    "@tauri-apps/cli-linux-arm64-gnu": "@tauri-apps/cli",
    "@esbuild/darwin-arm64": "esbuild",
    "@rolldown/binding-darwin-arm64": "rolldown",
    "@rollup/rollup-darwin-arm64": "rollup",
    "@tauri-apps/cli-darwin-arm64": "@tauri-apps/cli",
    "@esbuild/win32-x64": "esbuild",
    "@rolldown/binding-win32-x64-msvc": "rolldown",
    "@rollup/rollup-win32-x64-msvc": "rollup",
    "@rollup/rollup-win32-x64-gnu": "rollup",
    "@tauri-apps/cli-win32-x64-msvc": "@tauri-apps/cli",
}
SOURCE_SUFFIXES = {".rs", ".js", ".ts", ".c", ".h", ".cpp", ".py", ".go", ".toml", ".json"}


def read_json(path):
    return json.loads(Path(path).read_text())


def digest(data):
    return hashlib.sha256(data).hexdigest()


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n")


def slug(name, version):
    return name.replace("/", "__") + "-" + version


def notices(directory):
    result = []
    for base, dirs, files in os.walk(directory):
        dirs[:] = sorted(d for d in dirs if d not in {"node_modules", ".git", "target"})
        relative = Path(base).relative_to(directory)
        in_license_dir = any(re.fullmatch(r"licenses?|licences?", part, re.I) for part in relative.parts)
        for name in sorted(files):
            path = Path(base) / name
            if path.suffix.lower() in SOURCE_SUFFIXES:
                continue
            if in_license_dir or re.search(r"license|licence|copying|copyright|notice|unlicense", name, re.I):
                result.append(path)
    return result


def copy_with_hash(source, target, output, provenance):
    data = source.read_bytes()
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    return {"path": target.relative_to(output).as_posix(), "sha256": digest(data), "bytes": len(data), "source": provenance}


def supplemental_sources(fetch=False):
    sources = read_json(UPSTREAM / "SOURCES.json")
    for item in sources["files"]:
        path = UPSTREAM / item["path"]
        if fetch:
            with urllib.request.urlopen(item["url"], timeout=30) as response:
                data = response.read()
            if digest(data) != item["sha256"]:
                raise RuntimeError("Pinned upstream license changed: " + item["url"])
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
        if not path.is_file() or digest(path.read_bytes()) != item["sha256"]:
            raise RuntimeError("Missing or changed upstream license: " + str(path))
    return sources


def append_supplements(entry, directory, output, sources):
    urls = {item["path"]: item for item in sources["files"]}
    for relative in sources["packageSupplements"].get(entry["id"], []):
        entry["notices"].append(copy_with_hash(UPSTREAM / relative, directory / "upstream" / relative, output, urls[relative]["url"]))


def npm_roles(lock):
    packages = lock["packages"]
    roles = collections.defaultdict(set)
    queue = []

    def resolve(parent, name):
        current = Path(parent)
        while True:
            candidate = (current / "node_modules" / name).as_posix()
            if candidate in packages:
                return candidate
            if current == Path("."):
                return None
            current = current.parent

    for workspace in ["", "apps/desktop"]:
        manifest = read_json(ROOT / workspace / "package.json")
        for group, mode in [("dependencies", "runtime"), ("optionalDependencies", "runtime"), ("devDependencies", "development")]:
            for name in manifest.get(group, {}):
                key = resolve(workspace, name)
                if key:
                    queue.append((key, "build" if name in NPM_BINARY_PARENTS else mode))
    while queue:
        key, mode = queue.pop()
        if mode in roles[key]:
            continue
        roles[key].add(mode)
        package = packages[key]
        for group in ["dependencies", "optionalDependencies", "peerDependencies"]:
            for name in package.get(group, {}):
                child = resolve(key, name)
                if child:
                    queue.append((child, "build" if name in NPM_BINARY_PARENTS else mode))
    return roles


def npm_inventory(output, sources):
    lock = read_json(ROOT / "package-lock.json")
    roles = npm_roles(lock)
    entries, excluded = [], []
    for key, locked in sorted(lock["packages"].items()):
        if not key or key == "apps/desktop" or locked.get("link"):
            continue
        directory = ROOT / key
        if not directory.is_dir():
            if not locked.get("optional"):
                raise RuntimeError("Required locked package is not installed: " + key)
            excluded.append({"lockPath": key, "version": locked["version"], "reason": "optional package not installed for this platform", "os": locked.get("os"), "cpu": locked.get("cpu")})
            continue
        package = read_json(directory / "package.json")
        name, version = package["name"], package["version"]
        if version != locked["version"]:
            raise RuntimeError("Installed npm version differs from lock: " + key)
        destination = output / "npm" / slug(name, version)
        entry = {"id": f"npm:{name}@{version}", "ecosystem": "npm", "name": name, "version": version,
                 "roles": sorted(roles.get(key, {"development" if locked.get("dev") else "runtime"})),
                 "license": package.get("license", locked.get("license")), "repository": package.get("repository"),
                 "author": package.get("author"), "integrity": locked.get("integrity"), "resolved": locked.get("resolved"),
                 "lockPath": key, "notices": []}
        copy_with_hash(directory / "package.json", destination / "package.json", output, key + "/package.json")
        for source in notices(directory):
            relative = source.relative_to(directory)
            entry["notices"].append(copy_with_hash(source, destination / relative, output, key + "/" + relative.as_posix()))
        if name in NPM_BINARY_PARENTS:
            parent_path = ROOT / "node_modules" / NPM_BINARY_PARENTS[name]
            parent = read_json(parent_path / "package.json")
            if parent["version"] != version:
                raise RuntimeError("Binary/wrapper license version mismatch: " + name)
            for source in notices(parent_path):
                relative = source.relative_to(parent_path)
                entry["notices"].append(copy_with_hash(source, destination / "wrapper-license" / relative, output, f"same-release npm:{parent['name']}@{version}/{relative}"))
        append_supplements(entry, destination, output, sources)
        if not entry["notices"]:
            raise RuntimeError("No original license/notice for " + entry["id"])
        entries.append(entry)
    return entries, excluded


def cargo_inventory(output, sources, target):
    entries = {}
    for manifest in MANIFESTS:
        metadata = json.loads(subprocess.check_output(["cargo", "metadata", "--format-version", "1", "--locked", "--offline", "--filter-platform", target, "--manifest-path", str(ROOT / manifest)], cwd=ROOT))
        packages = {package["id"]: package for package in metadata["packages"]}
        nodes = {node["id"]: node for node in metadata["resolve"]["nodes"]}
        root_id = metadata["resolve"]["root"]
        roles = collections.defaultdict(set)
        queue = [(root_id, "runtime")]
        while queue:
            package_id, mode = queue.pop()
            if mode in roles[package_id]:
                continue
            roles[package_id].add(mode)
            for dependency in nodes[package_id]["deps"]:
                child = dependency["pkg"]
                for kind in dependency["dep_kinds"]:
                    if kind["kind"] == "dev" and package_id != root_id:
                        continue
                    next_mode = "development" if kind["kind"] == "dev" or mode == "development" else mode
                    proc_macro = any("proc-macro" in item["kind"] for item in packages[child]["targets"])
                    if next_mode != "development" and (kind["kind"] == "build" or proc_macro):
                        next_mode = "build"
                    queue.append((child, next_mode))
        lock = tomllib.loads((ROOT / manifest).with_name("Cargo.lock").read_text())
        checksums = {(p["name"], p["version"]): p.get("checksum") for p in lock["package"]}
        for package_id, modes in sorted(roles.items()):
            package = packages[package_id]
            directory = Path(package["manifest_path"]).parent.resolve()
            name, version = package["name"], package["version"]
            vendored_pty = name == "portable-pty" and directory == (ROOT / "apps/desktop/src-tauri/vendor/portable-pty").resolve()
            if package["source"] is None and not vendored_pty:
                continue
            entry_id = f"cargo:{name}@{version}"
            if entry_id in entries:
                entries[entry_id]["consumers"].append({"manifest": manifest, "roles": sorted(modes)})
                entries[entry_id]["roles"] = sorted(set(entries[entry_id]["roles"]) | modes)
                continue
            destination = output / "cargo" / slug(name, version)
            entry = {"id": entry_id, "ecosystem": "cargo", "name": name, "version": version,
                     "roles": sorted(modes), "consumers": [{"manifest": manifest, "roles": sorted(modes)}],
                     "license": package["license"], "repository": package["repository"], "authors": package["authors"],
                     "source": package["source"],
                     "checksum": checksums[name, version], "notices": []}
            if vendored_pty:
                entry["vendoredSource"] = {
                    "path": directory.relative_to(ROOT).as_posix(), "modified": True,
                    "files": {path.relative_to(directory).as_posix(): digest(path.read_bytes())
                              for path in sorted(directory.rglob("*")) if path.is_file()},
                }
            for filename in ["Cargo.toml", "Cargo.toml.orig", ".cargo_vcs_info.json"]:
                if (directory / filename).is_file():
                    copy_with_hash(directory / filename, destination / filename, output, f"crate:{name}@{version}/{filename}")
            license_files = notices(directory)
            if package.get("license_file"):
                path = directory / package["license_file"]
                if path.is_file() and path not in license_files:
                    license_files.append(path)
            for source in license_files:
                relative = source.relative_to(directory)
                entry["notices"].append(copy_with_hash(source, destination / relative, output, f"crate:{name}@{version}/{relative}"))
            if name == "rquickjs-core":
                source = ROOT / "apps/extension-host/licenses/rquickjs-MIT.txt"
                entry["notices"].append(copy_with_hash(source, destination / "LICENSE-MIT", output, "apps/extension-host/licenses/rquickjs-MIT.txt (same rquickjs 0.14.0 release)"))
            append_supplements(entry, destination, output, sources)
            if not entry["notices"]:
                raise RuntimeError("No original license/notice for " + entry_id)
            if "MPL-2.0" in (package["license"] or ""):
                archive = directory.parents[2] / "cache" / directory.parent.name / f"{name}-{version}.crate"
                if not archive.is_file() or digest(archive.read_bytes()) != entry["checksum"]:
                    raise RuntimeError("MPL source archive missing or checksum differs from Cargo.lock: " + str(archive))
                entry["sourceArchive"] = copy_with_hash(archive, output / "sources" / archive.name, output, f"https://static.crates.io/crates/{name}/{name}-{version}.crate")
                entry["sourceModified"] = False
            entries[entry_id] = entry
    return list(entries.values())


def generate(output, target, sources):
    npm, excluded = npm_inventory(output, sources)
    cargo = cargo_inventory(output, sources, target)
    entries = sorted(npm + cargo, key=lambda item: item["id"])
    locks = []
    for path in ["package-lock.json"] + [str(Path(m).with_name("Cargo.lock")) for m in MANIFESTS]:
        locks.append(copy_with_hash(ROOT / path, output / "locks" / path, output, path))
    bundled = []
    for name, version, directory in [
        ("ripgrep", "15.2.0", ROOT / "apps/desktop/src-tauri/licenses/ripgrep"),
        ("QuickJS-NG", "0.16.2", ROOT / "apps/extension-host/licenses"),
    ]:
        items = [copy_with_hash(p, output / "sidecars" / name / p.name, output, p.relative_to(ROOT).as_posix()) for p in sorted(directory.iterdir()) if p.is_file()]
        bundled.append({"name": name, "version": version, "notices": items})
    bundled.append({"name": "Lucide design atlas", "version": "0.468.0", "notices": [copy_with_hash(ROOT / "design/assets/LUCIDE-LICENSE", output / "design/LUCIDE-LICENSE", output, "design/assets/LUCIDE-LICENSE")]})
    rust_version = subprocess.check_output(["rustc", "--version"], text=True).strip()
    sysroot = Path(subprocess.check_output(["rustc", "--print", "sysroot"], text=True).strip())
    rust_notices = sysroot / "share/doc/rust"
    standard_library = [rust_notices / "COPYRIGHT-library.html"] + sorted((rust_notices / "licenses").glob("*.txt"))
    if not standard_library[0].is_file():
        raise RuntimeError("Rust standard-library copyright document missing from active toolchain")
    bundled.append({"name": "Rust standard library", "version": rust_version, "notices": [copy_with_hash(p, output / "rust-standard-library" / p.relative_to(rust_notices), output, "active rustc sysroot/share/doc/rust/" + p.relative_to(rust_notices).as_posix()) for p in standard_library], "scope": "Upstream standard-library copyright report; this includes upstream platform/build entries. Rust compiler itself is not redistributed."})
    inventory = {"schemaVersion": 1, "target": target, "lockfiles": locks, "packages": entries,
                 "bundledComponents": bundled, "excludedNpmPlatformOptions": excluded,
                 "scope": "Installed npm dependency closure and target-filtered Cargo normal/build/root-dev graph. Conservative dependency inventory; not a symbol-level bundle census. Rust proc-macros/build dependencies are classified separately. Platform npm compiler bindings are build tools even when declared optional dependencies.",
                 "externalTools": ["System Git and user shells are not redistributed", "Pi is separately installed on explicit request; it and Node are not bundled in Horizon", "macOS system frameworks/WebKit and Windows WebView2 are external platform runtimes"]}
    write_json(output / "inventory.json", inventory)
    lines = ["# Locked third-party dependency inventory", "", f"Target: `{target}`. {len(npm)} installed npm packages; {len(cargo)} Rust crates.", "", inventory["scope"], "", "Every row links the archived upstream notices. `package.json` / Cargo manifests retain original author and license declarations. The full JSON records integrity/checksum, consumers, origins and SHA-256 for each notice. Optional packages absent on this platform are listed separately in JSON and are not shipped.", "", "MPL-2.0 crates include their exact unmodified `.crate` source archive in `sources/`, verified against Cargo.lock. Extract with `tar -xzf <name-version.crate>`; individual package sources retain their original license.", ""]
    for ecosystem in ["npm", "cargo"]:
        lines += [f"## {ecosystem}", "", "| Package | Exact version | Use | Declared license | Original notices |", "| --- | --- | --- | --- | --- |"]
        for item in entries:
            if item["ecosystem"] != ecosystem:
                continue
            links = " · ".join(f"[{Path(n['path']).name}]({n['path']})" for n in item["notices"])
            license_text = str(item["license"]).replace("|", "\\|")
            lines.append(f"| {item['name']} | {item['version']} | {', '.join(item['roles'])} | {license_text} | {links} |")
        lines.append("")
    (output / "INDEX.md").write_text("\n".join(lines))
    files = {path.relative_to(output).as_posix(): digest(path.read_bytes()) for path in sorted(output.rglob("*")) if path.is_file()}
    write_json(output / "FILES.sha256.json", files)
    return {"npmPackages": len(npm), "cargoCrates": len(cargo), "files": len(files), "bytes": sum(p.stat().st_size for p in output.rglob("*") if p.is_file()), "missingNotices": 0}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--target", default="aarch64-apple-darwin")
    parser.add_argument("--check", action="store_true", help="Regenerate in a temporary directory and fail if archived bytes differ")
    parser.add_argument("--fetch-upstream", action="store_true", help="Restore pinned supplemental licenses from their exact URLs and verify SHA-256")
    args = parser.parse_args()
    sources = supplemental_sources(args.fetch_upstream)
    destination = BASE / "generated"
    with tempfile.TemporaryDirectory(prefix="horizon-license-archive-") as temporary:
        output = Path(temporary)
        summary = generate(output, args.target, sources)
        if args.check:
            expected = {p.relative_to(output).as_posix(): digest(p.read_bytes()) for p in output.rglob("*") if p.is_file()}
            actual = {p.relative_to(destination).as_posix(): digest(p.read_bytes()) for p in destination.rglob("*") if p.is_file()}
            if expected != actual:
                changed = sorted(key for key in expected.keys() | actual.keys() if expected.get(key) != actual.get(key))
                raise SystemExit("License archive differs; regenerate:\n" + "\n".join(changed[:25]))
        else:
            if destination.exists():
                shutil.rmtree(destination)
            shutil.copytree(output, destination)
        print(json.dumps({"checked" if args.check else "generated": str(destination.relative_to(ROOT)), **summary}))


if __name__ == "__main__":
    main()
