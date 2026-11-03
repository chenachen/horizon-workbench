#!/usr/bin/env python3
"""Parse every embedded WebDriver JavaScript body without starting native UI."""
import ast
import json
from pathlib import Path
import subprocess

sources = [Path(__file__).with_name(name) for name in (
    'linux-native-smoke.py', 'linux-native-extended.py', 'linux-plugin-gui.py')]
scripts = []
for source in sources:
    tree = ast.parse(source.read_text(encoding='utf-8'))
    for node in ast.walk(tree):
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr == 'js':
            if not node.args or not isinstance(node.args[0], ast.Constant) or not isinstance(node.args[0].value, str):
                raise AssertionError(f'Non-static WebDriver JavaScript at {source.name}:{node.lineno}')
            scripts.append({'file': source.name, 'line': node.lineno, 'body': node.args[0].value})
        if isinstance(node, ast.Dict):
            for key, value in zip(node.keys, node.values):
                if isinstance(key, ast.Constant) and key.value == 'script' and isinstance(value, ast.Constant):
                    scripts.append({'file': source.name, 'line': value.lineno, 'body': value.value})
if not scripts:
    raise AssertionError('No WebDriver JavaScript found')
subprocess.run(['node', '-e', '''
const fs = require('node:fs');
for (const {file, line, body} of JSON.parse(fs.readFileSync(0, 'utf8'))) {
  try { new Function(body); }
  catch (e) { throw new Error(`${file}:${line}: ${e.message}`); }
}
'''], input=json.dumps(scripts), text=True, check=True)
print(f'PASS: {len(scripts)} embedded WebDriver JavaScript bodies parsed by Node')
