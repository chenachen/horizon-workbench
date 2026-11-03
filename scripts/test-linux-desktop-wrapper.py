#!/usr/bin/env python3
"""Window-manager wrapper contract tests with stub tools, not desktop evidence."""
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

WRAPPER = Path(__file__).with_name('run-linux-desktop-test.sh').resolve()


class DesktopWrapperContract(unittest.TestCase):
    def test_command_exit_and_owned_wm_cleanup(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            tools = root / 'bin'
            tools.mkdir()
            (tools / 'openbox').write_text('''#!/bin/bash
trap 'touch "$FIXTURE/cleaned"; exit 0' TERM
printf '%s' "$$" > "$FIXTURE/pid"
touch "$FIXTURE/ready"
while :; do sleep 0.1; done
''')
            (tools / 'xprop').write_text('''#!/bin/bash
if [[ -f "$FIXTURE/ready" ]]; then
 echo '_NET_SUPPORTING_WM_CHECK(WINDOW): window id # 0x400001'
else
 echo '_NET_SUPPORTING_WM_CHECK: no such atom on any window.'
fi
''')
            for tool in tools.iterdir():
                tool.chmod(0o700)
            env = {**os.environ, 'PATH': f'{tools}:/usr/bin:/bin', 'FIXTURE': str(root),
                   'DISPLAY': ':fake', 'DBUS_SESSION_BUS_ADDRESS': 'stub-only',
                   'HORIZON_WM_LOG_DIR': str(root / 'logs')}
            completed = subprocess.run(['bash', str(WRAPPER), 'bash', '-c',
                                        'touch "$FIXTURE/command-ran"; exit 7'], env=env, capture_output=True, text=True, timeout=10)
            self.assertEqual(completed.returncode, 7, completed.stderr)
            self.assertTrue((root / 'command-ran').exists())
            self.assertTrue((root / 'cleaned').exists())
            self.assertTrue((root / 'logs/root-wm-check.txt').exists())
            self.assertFalse(Path('/proc', (root / 'pid').read_text()).exists())

    def test_requires_display_and_command(self):
        no_command = subprocess.run(['bash', str(WRAPPER)], capture_output=True, text=True)
        self.assertEqual(no_command.returncode, 2)
        env = dict(os.environ)
        env.pop('DISPLAY', None)
        missing_display = subprocess.run(['bash', str(WRAPPER), 'true'], env=env, capture_output=True, text=True)
        self.assertNotEqual(missing_display.returncode, 0)
        self.assertIn('Run this wrapper inside xvfb-run', missing_display.stderr)


if __name__ == '__main__':
    unittest.main(verbosity=2)
