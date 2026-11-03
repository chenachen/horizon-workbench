#!/usr/bin/env python3
"""Exercise an installed native Horizon through official tauri-driver/WebKit.

Run inside an authorized Linux display + D-Bus session, for example:
  xvfb-run -a dbus-run-session -- python3 scripts/linux-native-smoke.py \
    --application /usr/bin/horizon-desktop --artifacts artifacts/linux/gui
No browser preview, mocks, saved credentials or paid APIs are used.
Reference: https://v2.tauri.app/develop/tests/webdriver/manual-setup/
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import time
import traceback
import urllib.error
import urllib.request

ELEMENT = 'element-6066-11e4-a52e-4f735466cecf'


class WebDriver:
    def __init__(self, base: str):
        self.base, self.session = base.rstrip('/'), None

    def request(self, method: str, path: str, data=None):
        encoded = None if data is None else json.dumps(data).encode()
        request = urllib.request.Request(self.base + path, data=encoded, method=method,
                                         headers={'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(request, timeout=90) as response:
                result = json.load(response)
        except urllib.error.HTTPError as error:
            raise RuntimeError(f'{method} {path}: {error.code} {error.read().decode(errors="replace")}') from error
        value = result.get('value', result)
        if isinstance(value, dict) and value.get('error'):
            raise RuntimeError(f'{method} {path}: {value}')
        return value

    def command(self, method: str, path: str, data=None):
        if self.session is None:
            raise RuntimeError('No native application session')
        return self.request(method, f'/session/{self.session}{path}', data)

    def start(self, application: str):
        result = self.request('POST', '/session', {'capabilities': {'alwaysMatch': {
            'browserName': 'wry', 'tauri:options': {'application': application}}}})
        self.session = result['sessionId']
        self.command('POST', '/timeouts', {'implicit': 0, 'script': 30000, 'pageLoad': 60000})

    def close(self):
        if self.session:
            session, self.session = self.session, None
            self.request('DELETE', f'/session/{session}')

    def js(self, script: str, *args):
        return self.command('POST', '/execute/sync', {'script': script, 'args': list(args)})

    def wait(self, test, description: str, timeout=45):
        deadline, last = time.monotonic() + timeout, None
        while time.monotonic() < deadline:
            try:
                value = test()
                if value:
                    return value
            except (RuntimeError, urllib.error.URLError, OSError) as error:
                last = str(error)
            time.sleep(.2)
        raise AssertionError(f'Timed out: {description}; last={last}')

    def find(self, selector: str, using='css selector'):
        return self.command('POST', '/element', {'using': using, 'value': selector})[ELEMENT]

    def interactable(self, selector: str, using='css selector'):
        def ready():
            element = self.find(selector, using)
            if not self.command('GET', f'/element/{element}/enabled'):
                return None
            # W3C has an enabled endpoint, but no portable displayed endpoint.
            # Inspect visibility only; the interaction remains a WebDriver click.
            # An option is interacted with through its visible parent select.
            visible = self.js("""
let element = arguments[0];
if (element.tagName === 'OPTION') element = element.closest('select');
if (!element || !element.getClientRects().length) return false;
const style = getComputedStyle(element);
return style.display !== 'none' && style.visibility !== 'hidden' && style.visibility !== 'collapse';
""", {ELEMENT: element})
            return element if visible else None
        return self.wait(ready, f'visible enabled element {selector}')

    def click(self, selector: str, using='css selector'):
        element = self.interactable(selector, using)
        self.command('POST', f'/element/{element}/click', {})

    def button_text(self, text: str, prefix='//'):
        # Only fixed fixture/UI strings are supplied by this script.
        self.click(f'{prefix}button[normalize-space(.)={json.dumps(text, ensure_ascii=False)}]', 'xpath')

    def type(self, selector: str, value: str):
        element = self.interactable(selector)
        self.command('POST', f'/element/{element}/clear', {})
        self.command('POST', f'/element/{element}/value', {'text': value, 'value': list(value)})

    def keys(self, selector: str, value: str):
        """Send actual W3C keyboard input without clearing editor/terminal buffers."""
        element = self.wait(lambda: self.find(selector), f'keyboard target {selector}')
        self.command('POST', f'/element/{element}/value', {'text': value, 'value': list(value)})

    def capture(self, directory: Path, name: str):
        problems = []
        for kind in ('screenshot', 'source', 'text'):
            try:
                if kind == 'screenshot':
                    (directory / f'{name}.png').write_bytes(base64.b64decode(self.command('GET', '/screenshot')))
                elif kind == 'source':
                    (directory / f'{name}.html').write_text(self.command('GET', '/source'), encoding='utf-8')
                else:
                    (directory / f'{name}.txt').write_text(self.js('return document.body.innerText;'), encoding='utf-8')
            except Exception as error:
                problems.append(f'{kind}: {error}')
        return problems

    def bootstrap(self):
        value = self.command('POST', '/execute/async', {'script': '''
const done = arguments[arguments.length - 1];
window.__TAURI_INTERNALS__.invoke('horizon_call', {call: {
  protocolVersion: 1, requestId: crypto.randomUUID(),
  method: 'app_bootstrap', scope: {kind: 'app'},
  params: {clientVersion: '0.1.0', protocolVersion: 1},
  idempotencyKey: crypto.randomUUID()
}}).then(done, e => done({invokeError: String(e)}));
''', 'args': []})
        if not isinstance(value, dict) or value.get('ok') is not True:
            raise AssertionError(f'Native bootstrap IPC failed: {value}')
        return value['data']


def native_processes(application: Path):
    matches = []
    for proc in Path('/proc').iterdir():
        if not proc.name.isdigit():
            continue
        try:
            executable = (proc / 'exe').resolve(strict=True)
            if executable == application:
                matches.append({'pid': int(proc.name), 'executable': str(executable)})
        except (OSError, RuntimeError):
            continue
    return matches


def executable_paths(application_arg, expected_arg=None):
    """Keep direct-executable identity strict; allow an explicitly named launcher."""
    application = Path(application_arg).resolve(strict=True)
    expected = Path(expected_arg).resolve(strict=True) if expected_arg else application
    for role, path in (('Application launcher', application), ('Expected native executable', expected)):
        if not path.is_file() or not os.access(path, os.X_OK):
            raise ValueError(f'{role} is not an executable file: {path}')
    return application, expected


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--application', default='/usr/bin/horizon-desktop')
    parser.add_argument('--expected-executable', help='Explicit native executable behind a launcher, e.g. extracted AppDir/usr/bin/horizon-desktop; default exactly --application')
    parser.add_argument('--artifacts', default='artifacts/linux/gui')
    parser.add_argument('--driver', default='tauri-driver')
    parser.add_argument('--port', type=int, default=4444)
    parser.add_argument('--extended', action='store_true', help='Run native editor/file/search/Git/terminal/plugin scenarios with synthetic fixtures')
    args = parser.parse_args()
    application, expected_executable = executable_paths(args.application, args.expected_executable)
    driver_binary = shutil.which(args.driver)
    if driver_binary is None:
        raise SystemExit(f'Official tauri-driver missing: {args.driver}')
    output = Path(args.artifacts).resolve()
    output.mkdir(parents=True, exist_ok=True)
    home = Path(tempfile.mkdtemp(prefix='isolated-home-', dir=output))
    # xvfb-run stores its display cookie outside the isolated HOME; retain its
    # explicit XAUTHORITY pointer, but never inherit arbitrary account/API secrets.
    env = {key: os.environ[key] for key in (
        'PATH', 'DISPLAY', 'XAUTHORITY', 'WAYLAND_DISPLAY', 'DBUS_SESSION_BUS_ADDRESS', 'XDG_RUNTIME_DIR',
        'AT_SPI_BUS_ADDRESS', 'GTK_MODULES',
        'LANG', 'LC_ALL', 'LD_LIBRARY_PATH', 'LIBGL_ALWAYS_SOFTWARE', 'GDK_BACKEND',
        'WEBKIT_DISABLE_DMABUF_RENDERER', 'WEBKIT_DISABLE_COMPOSITING_MODE'
    ) if key in os.environ}
    env.update(HOME=str(home), XDG_CONFIG_HOME=str(home / '.config'),
               XDG_DATA_HOME=str(home / '.local/share'), XDG_CACHE_HOME=str(home / '.cache'))
    for location in (env['XDG_CONFIG_HOME'], env['XDG_DATA_HOME'], env['XDG_CACHE_HOME']):
        Path(location).mkdir(parents=True, exist_ok=True)
    result = {'status': 'running', 'application': str(application),
              'applicationSha256': hashlib.sha256(application.read_bytes()).hexdigest(),
              'expectedExecutable': str(expected_executable),
              'expectedExecutableSha256': hashlib.sha256(expected_executable.read_bytes()).hexdigest(),
              'launchMode': 'explicit-launcher' if args.expected_executable else 'direct-installed-executable',
              'driver': driver_binary, 'startedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
              'isolatedHome': str(home), 'checks': [], 'screenshots': [],
              'coverage': ['installed native launch and IPC', 'workspace cancel/create/persistence',
                           'settings theme click/persistence', 'modal close/reopen',
                           'relaunch of the installed application'],
              'notCovered': ['AppImage FUSE mounting' if args.expected_executable else 'AppImage runtime launch', 'Wayland session',
                             'native file picker', 'project editing/terminal/Git GUI',
                             'AI runtime activation or paid API', 'system keyring integration',
                             'ARM64 or macOS/Windows native behavior']}
    wd = WebDriver(f'http://127.0.0.1:{args.port}')
    log = (output / 'tauri-driver.log').open('w', encoding='utf-8')
    driver = subprocess.Popen([driver_binary, '--port', str(args.port)], env=env,
                              stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
    def check(name, action):
        started = time.monotonic()
        action()
        result['checks'].append({'name': name, 'passed': True, 'seconds': round(time.monotonic() - started, 3)})
        print(f'PASS {name}', flush=True)
    def capture(name):
        errors = wd.capture(output, name)
        result['screenshots'].append({'name': name, 'captureErrors': errors})
        if errors:
            raise AssertionError(f'Evidence capture failed: {errors}')
    def boot():
        if native_processes(expected_executable):
            raise AssertionError('Expected executable was already running before this launch')
        wd.start(str(application))
        wd.wait(lambda: wd.js('return !!window.__TAURI_INTERNALS__ && !!document.querySelector(".welcome") && !document.querySelector(".boot-error");'), 'native welcome screen')
        proof = {'processes': wd.wait(lambda: native_processes(expected_executable), 'exact expected native process'),
                 'document': wd.js('return {url: location.href, userAgent: navigator.userAgent, native: !!window.__TAURI_INTERNALS__};'),
                 'bootstrap': wd.bootstrap()}
        if not proof['document']['native'] or proof['document']['url'].startswith(('http://127.0.0.1:', 'http://localhost:')):
            raise AssertionError(f'Expected packaged native application, not dev preview: {proof}')
        result.setdefault('launches', []).append(proof)
    try:
        wd.wait(lambda: wd.request('GET', '/status'), 'tauri-driver ready', timeout=30)
        check('installed native application launch and real IPC', boot)
        capture('01-native-welcome')
        workspace_name = 'Linux native smoke workspace'
        def workspace_flow():
            # The welcome layout deliberately hides project-navigation (styles.css).
            # Use the visible first-run entry, not the hidden navigation button.
            wd.click('.welcome button.all-projects')
            wd.button_text('新建工作区')
            wd.wait(lambda: wd.js('return !!document.querySelector(arguments[0]);', 'dialog[open] input[placeholder="例如：个人项目"]'), 'workspace form')
            wd.type('dialog[open] input[placeholder="例如：个人项目"]', 'Cancelled fixture')
            wd.button_text('取消', '//dialog[@open]//')
            wd.wait(lambda: wd.js('return !document.querySelector("dialog[open]");'), 'cancelled modal dismissed')
            assert not any(w['name'] == 'Cancelled fixture' for w in wd.bootstrap()['workspaces'])
            wd.button_text('新建工作区')
            wd.type('dialog[open] input[placeholder="例如：个人项目"]', workspace_name)
            wd.button_text('创建工作区', '//dialog[@open]//')
            wd.wait(lambda: wd.js('return !document.querySelector("dialog[open]");'), 'created workspace modal dismissed')
            wd.wait(lambda: any(w['name'] == workspace_name for w in wd.bootstrap()['workspaces']), 'workspace persisted through native IPC')
            assert wd.js('return Array.from(document.querySelector(arguments[0]).options).some(o => o.text === arguments[1]);', 'select[aria-label="切换工作区"]', workspace_name)
        check('real workspace UI cancel, reopen, create and persistence', workspace_flow)
        capture('02-created-workspace')
        def theme_flow():
            wd.click('button[aria-label="设置"]')
            wd.wait(lambda: wd.find('dialog[open] select[aria-label="明暗模式"]'), 'native settings loaded')
            wd.click('dialog[open] select[aria-label="明暗模式"] option[value="dark"]')
            wd.wait(lambda: wd.js('return document.documentElement.dataset.mode === "dark";'), 'dark theme applied')
            wd.button_text('完成', '//dialog[@open]//')
            wd.wait(lambda: wd.js('return !document.querySelector("dialog[open]");'), 'settings persisted and closed')
            wd.click('button[aria-label="设置"]')
            wd.wait(lambda: wd.js('return document.querySelector(arguments[0])?.value === arguments[1];', 'dialog[open] select[aria-label="明暗模式"]', 'dark'), 'saved dark selection after reopen')
            capture('03-settings-dark')
            wd.click('dialog[open] button[aria-label="关闭弹窗"]')
            wd.wait(lambda: wd.js('return !document.querySelector("dialog[open]");'), 'settings close')
        check('real settings theme selection and close/reopen', theme_flow)
        wd.close()
        wd.wait(lambda: not native_processes(expected_executable), 'first native process exited', timeout=30)
        check('second native application launch', boot)
        def persisted():
            assert any(w['name'] == workspace_name for w in wd.bootstrap()['workspaces'])
            wd.wait(lambda: wd.js('return document.documentElement.dataset.mode === "dark";'), 'dark mode persisted across process restart')
            wd.click('button[aria-label="设置"]')
            wd.wait(lambda: wd.js('return document.querySelector(arguments[0])?.value === arguments[1];', 'dialog[open] select[aria-label="明暗模式"]', 'dark'), 'settings persisted across native restart')
            wd.button_text('完成', '//dialog[@open]//')
            wd.wait(lambda: wd.js('return !document.querySelector("dialog[open]");'), 'final modal dismissal')
        check('workspace and theme survive native process restart', persisted)
        capture('04-native-restarted')
        if args.extended:
            spec = importlib.util.spec_from_file_location('linux_native_extended', Path(__file__).with_name('linux-native-extended.py'))
            extended = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(extended)
            extended.run(wd, check, capture, result, output, env)
            result['notCovered'] = ['AppImage runtime launch', 'Wayland session',
                                    'AI runtime activation or paid API', 'system keyring integration',
                                    'remote Git authentication', 'ARM64 or macOS/Windows native behavior']
        result['status'] = 'passed'
    except Exception as error:
        result['status'], result['error'], result['traceback'] = 'failed', str(error), traceback.format_exc()
        if wd.session:
            result['failureCaptureErrors'] = wd.capture(output, 'failure')
        if args.extended:
            try:
                subprocess.run(['scrot', str(output / 'failure-desktop.png')], env=env, check=True)
            except Exception as capture_error:
                result['failureDesktopCaptureError'] = str(capture_error)
        print(result['traceback'], file=sys.stderr, flush=True)
    finally:
        try:
            wd.close()
        except Exception as error:
            result['cleanupError'] = str(error)
        driver.terminate()
        try:
            driver.wait(timeout=10)
        except subprocess.TimeoutExpired:
            driver.kill()
            driver.wait(timeout=5)
        log.close()
        result['finishedAt'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
        (output / 'result.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    return 0 if result['status'] == 'passed' else 1


if __name__ == '__main__':
    sys.exit(main())
