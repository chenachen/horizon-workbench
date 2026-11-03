"""Additional installed-app GUI scenarios; no mocked bridge or external services."""
import importlib.util
import json
import os
import re
from pathlib import Path
import subprocess
import time

ELEMENT = 'element-6066-11e4-a52e-4f735466cecf'


def run(wd, check, capture, result, output, env):
    fixture = output / 'project-fixture'
    fixture.mkdir()
    def command(*args):
        return subprocess.check_output(args, cwd=fixture, env=env, text=True).strip()
    command('git', 'init', '-b', 'main')
    command('git', 'config', 'user.name', 'Horizon Native Test')
    command('git', 'config', 'user.email', 'horizon-test@example.invalid')
    (fixture / 'sample.txt').write_text('HORIZON_SEARCH_ORIGINAL\n', encoding='utf-8')
    command('git', 'add', 'sample.txt')
    command('git', 'commit', '-m', 'Synthetic native GUI fixture')
    result['fixture'] = {'path': str(fixture), 'setupIsNotGuiAcceptance': True,
                         'gitHeadBefore': command('git', 'rev-parse', 'HEAD'), 'externalRemote': False}

    def has(selector):
        return wd.js('return !!document.querySelector(arguments[0]);', selector)

    def text(selector):
        return wd.js('return document.querySelector(arguments[0])?.textContent || "";', selector)

    def git(*args):
        return command('git', *args)

    def open_project():
        # Two real cancel/reopen cycles, then the system chooser (not registry injection).
        for _ in range(2):
            wd.button_text('打开本地项目')
            wd.wait(lambda: has('dialog[open] input[aria-label="项目目录"]'), 'add project modal')
            wd.button_text('取消', '//dialog[@open]//')
            wd.wait(lambda: not has('dialog[open]'), 'cancel add project')
        wd.button_text('打开本地项目')
        main_window = command('xdotool', 'getwindowfocus')
        wd.button_text('选择', '//dialog[@open]//')
        # GTK owns a native modal outside WebDriver's DOM. Locate the actual focused
        # window, verify its PID belongs to this installed app, then send real keys.
        app_pids = {str(p['pid']) for p in result['launches'][-1]['processes']}
        def picker_focus():
            try:
                win = command('xdotool', 'getwindowfocus')
                pid = command('xdotool', 'getwindowpid', win)
                name = command('xdotool', 'getwindowname', win)
            except subprocess.CalledProcessError:
                return None
            return {'window': win, 'pid': pid, 'name': name} if pid in app_pids and win != main_window else None
        focused = wd.wait(picker_focus, 'native picker focus owned by installed app', timeout=15)
        result['nativePicker'] = {'mainWindow': main_window, 'focus': focused, 'inputPath': str(fixture)}
        subprocess.run(['scrot', str(output / '05-system-picker.png')], env=env, check=True)
        command('xdotool', 'key', '--clearmodifiers', 'ctrl+l')
        command('xdotool', 'type', '--clearmodifiers', '--delay', '2', str(fixture))
        command('xdotool', 'key', '--clearmodifiers', 'Return')
        time.sleep(1)
        # A first Return may navigate into the folder rather than accept it.
        # Do not issue a WebDriver command while a GTK native modal is open:
        # its nested event loop may block WebKit automation until dismissal.
        if picker_focus():
            command('xdotool', 'key', '--clearmodifiers', 'Return')
        wd.wait(lambda: picker_focus() is None, 'native folder picker dismissed', timeout=20)
        chosen = lambda: wd.js('return document.querySelector(arguments[0])?.value === arguments[1];', 'dialog[open] input[aria-label="项目目录"]', str(fixture))
        wd.wait(chosen, 'native picker returned exact fixture directory', timeout=20)
        wd.type('dialog[open] input[placeholder="项目名称"]', 'Linux extended fixture')
        wd.button_text('添加并打开', '//dialog[@open]//')
        wd.wait(lambda: not has('dialog[open]') and has('.file-tree-row[title="sample.txt"]'), 'project open with real file tree')
        capture('06-project-open')
    check('native project picker, add cancellation twice and actual project open', open_project)

    def edit_save():
        wd.click('.file-tree-row[title="sample.txt"]')
        wd.wait(lambda: has('.cm-content[contenteditable="true"]'), 'CodeMirror editable surface')
        wd.click('.cm-content[contenteditable="true"]')
        wd.keys('.cm-content[contenteditable="true"]', '\ue009a\ue000HORIZON_SEARCH_SAVED\n')
        wd.wait(lambda: has('.dirty-dot'), 'dirty document indicator')
        wd.click('button[aria-label="关闭 sample.txt"]')
        wd.wait(lambda: has('.document-close-dialog'), 'unsaved close dialog')
        wd.button_text('取消', '//section[contains(@class,"document-close-dialog")]//')
        wd.wait(lambda: not has('.document-close-dialog'), 'unsaved close cancelled')
        assert (fixture / 'sample.txt').read_text() == 'HORIZON_SEARCH_ORIGINAL\n'
        wd.click('button[aria-label="保存文件"]')
        wd.wait(lambda: (fixture / 'sample.txt').read_text() == 'HORIZON_SEARCH_SAVED\n', 'GUI save reached disk')
        wd.click('button[aria-label="关闭 sample.txt"]')
        wd.wait(lambda: not has('.document-tab'), 'saved tab closed')
        wd.click('.file-tree-row[title="sample.txt"]')
        wd.wait(lambda: 'HORIZON_SEARCH_SAVED' in text('.cm-content'), 'saved file reopened')
        capture('07-editor-save-reopen')
    check('native editor keyboard edit, cancel close, save and reopen', edit_save)

    def files():
        wd.click('button[aria-label="新建文件"]')
        wd.type('.tree-edit input', 'cancelled.txt')
        wd.button_text('取消', '//form[contains(@class,"tree-edit")]//')
        wd.wait(lambda: not has('.tree-edit'), 'new file cancelled')
        assert not (fixture / 'cancelled.txt').exists()
        wd.click('button[aria-label="新建文件"]')
        wd.type('.tree-edit input', 'created.txt')
        wd.button_text('确定', '//form[contains(@class,"tree-edit")]//')
        wd.wait(lambda: (fixture / 'created.txt').is_file(), 'new file on disk')
        # Test duplicate creation refusal without touching existing content.
        wd.click('button[aria-label="新建文件"]')
        wd.type('.tree-edit input', 'created.txt')
        wd.button_text('确定', '//form[contains(@class,"tree-edit")]//')
        wd.wait(lambda: has('.file-tree-notice[role="alert"]'), 'duplicate file rejected visibly')
        assert (fixture / 'created.txt').read_bytes() == b''
        if has('.tree-edit'):
            wd.button_text('取消', '//form[contains(@class,"tree-edit")]//')
        capture('08-file-create-duplicate-rejected')
    check('native file create cancellation, creation and duplicate refusal', files)

    def search():
        wd.click('.sidebar-tabs button[aria-label="搜索"]')
        wd.type('input[aria-label="搜索文本"]', 'HORIZON_SEARCH_SAVED')
        wd.wait(lambda: 'HORIZON_SEARCH_SAVED' in text('.search-results'), 'ripgrep result delivered to native UI')
        wd.type('input[aria-label="搜索文本"]', 'HORIZON_NO_SUCH_MATCH_782')
        wd.wait(lambda: '没有' in text('.project-search') or '无匹配' in text('.project-search'), 'empty search result')
        wd.type('input[aria-label="搜索文本"]', 'HORIZON_SEARCH_SAVED')
        wd.wait(lambda: 'HORIZON_SEARCH_SAVED' in text('.search-results'), 'repeated search returns new result')
        capture('09-project-search-repeat')
    check('native project search, empty query result and repeat', search)

    def git_flow():
        wd.button_text('Git', '//div[contains(@class,"sidebar-tabs")]//')
        wd.wait(lambda: has('button[aria-label="暂存 sample.txt"]'), 'changed file Git status')
        wd.click('button[aria-label="暂存 sample.txt"]')
        wd.wait(lambda: git('diff', '--cached', '--name-only') == 'sample.txt', 'GUI stage updated Git index')
        wd.click('button[aria-label="取消暂存 sample.txt"]')
        wd.wait(lambda: git('diff', '--cached', '--name-only') == '', 'GUI unstage updated Git index')
        wd.click('button[aria-label="暂存 sample.txt"]')
        wd.wait(lambda: git('diff', '--cached', '--name-only') == 'sample.txt', 'GUI repeated stage')
        wd.type('#git-commit-message', 'Linux native GUI commit')
        wd.click('.git-commit button[type="submit"]')
        wd.wait(lambda: git('log', '-1', '--format=%s') == 'Linux native GUI commit', 'GUI commit created real Git object')
        assert git('show', 'HEAD:sample.txt') == 'HORIZON_SEARCH_SAVED'
        assert git('diff', '--cached', '--name-only') == ''
        result['fixture']['gitHeadAfter'] = git('rev-parse', 'HEAD')
        capture('10-git-stage-unstage-commit')
    check('native Git stage, unstage, restage and local commit', git_flow)

    plugin_path = Path(__file__).with_name('linux-plugin-gui.py')
    spec = importlib.util.spec_from_file_location('linux_plugin_gui', plugin_path)
    plugin = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(plugin)
    plugin.enable_terminal(wd, check, capture, result)

    def terminal():
        wd.click('header button[aria-label="切换终端"]')
        wd.click('button[aria-label="新建终端"]')
        for attempt in range(2):
            wd.wait(lambda: has('.process-xterm textarea.xterm-helper-textarea'), 'real PTY input surface')
            label = wd.js('return document.querySelector(arguments[0])?.selectedOptions[0]?.textContent || "";', 'select[aria-label="终端会话"]')
            pid_match = re.search(r'·\s*(\d+)\s*·', label)
            assert pid_match, f'Terminal UI did not expose its process identity: {label}'
            pid = int(pid_match.group(1))
            assert Path(f'/proc/{pid}').exists(), f'Terminal process {pid} missing before keyboard input'
            result.setdefault('terminalProcesses', []).append({'pid': pid, 'initialLabel': label})
            target = f'terminal-proof-{attempt}.txt'
            wd.keys('.process-xterm textarea.xterm-helper-textarea', f"printf 'HORIZON_TERMINAL_{attempt}\\n' | tee {target}\ue007")
            wd.wait(lambda: (fixture / target).exists() and (fixture / target).read_text() == f'HORIZON_TERMINAL_{attempt}\n', 'terminal keyboard command executed in project cwd')
            capture(f'11-terminal-command-{attempt}')
            wd.click('button[aria-label="结束进程"]')
            wd.wait(lambda: wd.js('return document.querySelector(arguments[0])?.selectedOptions[0]?.textContent.includes(arguments[1]) && document.querySelector(arguments[2])?.disabled === false;', 'select[aria-label="终端会话"]', '已退出', 'button[aria-label="新建终端"]'), 'terminal UI exited and stop no longer busy')
            wd.wait(lambda: not Path(f'/proc/{pid}').exists(), 'owned terminal process actually exited')
            result['terminalProcesses'][-1]['exitedVerified'] = True
            if attempt == 0:
                wd.click('button[aria-label="新建终端"]')
        wd.click('button[aria-label="隐藏终端面板"]')
    check('native terminal keyboard input, stop and fresh terminal repeat', terminal)

    plugin.run(wd, check, capture, result)
    result['extendedCoverage'] = ['native GTK folder selection', 'project add cancel/reopen',
        'editor keyboard edit/save/cancel close/reopen', 'file create/cancel/duplicate rejection',
        'project ripgrep search/repeat', 'Git stage/unstage/commit', 'terminal command/stop/restart',
        'plugin lifecycle (see individual checks)']
