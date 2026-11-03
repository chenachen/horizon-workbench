#!/usr/bin/env python3
"""Test harness transport contracts only: NOT native UI verification."""
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('linux_smoke', Path(__file__).with_name('linux-native-smoke.py'))
smoke = importlib.util.module_from_spec(spec)
spec.loader.exec_module(smoke)


class RecordingDriver(smoke.WebDriver):
    def __init__(self):
        super().__init__('http://127.0.0.1:4444/')
        self.calls = []
        self.enabled = [True]

    def request(self, method, path, data=None):
        self.calls.append((method, path, data))
        if path == '/session' and method == 'POST':
            return {'sessionId': 'test-session', 'capabilities': {}}
        if path.endswith('/element'):
            return {smoke.ELEMENT: 'test-element'}
        if path.endswith('/enabled'):
            return self.enabled.pop(0) if len(self.enabled) > 1 else self.enabled[0]
        if path.endswith('/execute/sync'):
            return True
        if path.endswith('/execute/async'):
            return {'ok': True, 'data': {'workspaces': []}}
        return None


class HarnessContract(unittest.TestCase):
    def setUp(self):
        self.wd = RecordingDriver()
        self.wd.start('/usr/bin/horizon-desktop')

    def test_session_capabilities_and_timeout(self):
        self.assertEqual(self.wd.calls[:2], [
            ('POST', '/session', {'capabilities': {'alwaysMatch': {
                'browserName': 'wry', 'tauri:options': {'application': '/usr/bin/horizon-desktop'}}}}),
            ('POST', '/session/test-session/timeouts', {'implicit': 0, 'script': 30000, 'pageLoad': 60000})])
        self.wd.close()
        self.assertIsNone(self.wd.session)
        self.assertEqual(self.wd.calls[-1], ('DELETE', '/session/test-session', None))
        count = len(self.wd.calls)
        self.wd.close()
        self.assertEqual(len(self.wd.calls), count)
        with self.assertRaises(RuntimeError):
            self.wd.js('return true;')

    def test_click_uses_real_element_endpoint(self):
        self.wd.click('.welcome button.all-projects')
        self.assertIn(('POST', '/session/test-session/element', {'using': 'css selector', 'value': '.welcome button.all-projects'}), self.wd.calls)
        self.assertEqual(self.wd.calls[-1], ('POST', '/session/test-session/element/test-element/click', {}))
        self.assertIn(('GET', '/session/test-session/element/test-element/enabled', None), self.wd.calls)
        self.assertEqual(self.wd.calls[-2][2]['args'], [{smoke.ELEMENT: 'test-element'}])
        self.wd.button_text('创建工作区', '//dialog[@open]//')
        self.assertIn(('POST', '/session/test-session/element', {'using': 'xpath', 'value': '//dialog[@open]//button[normalize-space(.)="创建工作区"]'}), self.wd.calls)

    def test_disabled_button_waits_before_click(self):
        self.wd.enabled = [False, True]
        self.wd.click('button')
        enabled_calls = [call for call in self.wd.calls if call[1].endswith('/enabled')]
        clicks = [call for call in self.wd.calls if call[1].endswith('/click')]
        self.assertEqual(len(enabled_calls), 2)
        self.assertEqual(len(clicks), 1)
        self.assertEqual(self.wd.calls[-1], clicks[0])

    def test_unicode_input_clear_then_type(self):
        selector, value = 'dialog[open] input[placeholder="例如：个人项目"]', '工作区 test'
        self.wd.type(selector, value)
        self.assertEqual(self.wd.calls[-3:], [
            ('POST', '/session/test-session/element', {'using': 'css selector', 'value': selector}),
            ('POST', '/session/test-session/element/test-element/clear', {}),
            ('POST', '/session/test-session/element/test-element/value', {'text': value, 'value': list(value)})])

    def test_editor_terminal_keys_do_not_clear(self):
        value = '\ue009a\ue000new contents\ue007'
        self.wd.keys('.cm-content', value)
        self.assertEqual(self.wd.calls[-2:], [
            ('POST', '/session/test-session/element', {'using': 'css selector', 'value': '.cm-content'}),
            ('POST', '/session/test-session/element/test-element/value', {'text': value, 'value': list(value)})])
        self.assertFalse(any(call[1].endswith('/clear') for call in self.wd.calls))

    def test_js_arguments_not_interpolated(self):
        body = 'return document.querySelector(arguments[0])?.value === arguments[1];'
        selector = 'dialog[open] select[aria-label="明暗模式"]'
        self.wd.js(body, selector, 'dark')
        self.assertEqual(self.wd.calls[-1], ('POST', '/session/test-session/execute/sync', {
            'script': body, 'args': [selector, 'dark']}))

    def test_bootstrap_uses_actual_ipc_command(self):
        self.assertEqual(self.wd.bootstrap(), {'workspaces': []})
        method, path, data = self.wd.calls[-1]
        self.assertEqual((method, path), ('POST', '/session/test-session/execute/async'))
        self.assertEqual(data['args'], [])
        self.assertIn("window.__TAURI_INTERNALS__.invoke('horizon_call'", data['script'])
        self.assertIn("method: 'app_bootstrap'", data['script'])
        self.wd.request = lambda *args: {'ok': False, 'error': 'fixture'}
        with self.assertRaises(AssertionError):
            self.wd.bootstrap()


if __name__ == '__main__':
    unittest.main(verbosity=2)
