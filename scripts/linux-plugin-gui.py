"""Real installed-app plugin GUI scenario; no IPC mutation or mocked bridge.

Uses isolated test account data. Does not test package installation, permission
approval, third-party execution, or stopping an actively running plugin instance.
"""

CARD = '//article[contains(concat(" ", normalize-space(@class), " "), " plugin-card ")][.//h3[normalize-space(.)="Markdown 预览"]]'
DETAIL = '//section[@aria-label="扩展详情"]//'
DIALOG = '//dialog[@open and contains(concat(" ", normalize-space(@class), " "), " plugin-dialog ")]//'


def run(wd, check, capture, result):
    def detail_text():
        return wd.js('return document.querySelector(arguments[0])?.innerText || "";', 'section[aria-label="扩展详情"]')

    def state_text():
        return wd.js('return document.querySelector(arguments[0])?.textContent.trim() || "";', '.plugin-detail-heading .plugin-state')

    def enabled_state():
        return state_text() in ('待激活', '运行中', '启动中', '已休眠', '无需进程')

    def no_dialog():
        return wd.js('return !document.querySelector(arguments[0]);', 'dialog.plugin-dialog[open]')

    def wait_stop():
        wd.wait(lambda: wd.js('return document.querySelector(arguments[0])?.textContent.includes(arguments[1]);', 'dialog.plugin-dialog[open]', '停用 Markdown 预览？'), 'Markdown disable confirmation')

    def no_plugin_error():
        errors = wd.js('return Array.from(document.querySelectorAll(arguments[0])).map(e => e.innerText).filter(Boolean);', '.plugin-center .plugin-error')
        assert not errors, f'Plugin UI reported errors: {errors}'

    def inspect():
        wd.click('header.topbar button[aria-label="插件中心"]')
        wd.wait(lambda: wd.find('input[aria-label="搜索扩展"]'), 'installed plugin catalogue')
        wd.click('select[aria-label="操作范围"] option[value="global"]')
        wd.wait(lambda: wd.js('return document.querySelector(arguments[0])?.value === arguments[1];', 'select[aria-label="操作范围"]', 'global'), 'explicit global scope in isolated fixture')
        wd.type('input[aria-label="搜索扩展"]', 'horizon.markdown')
        wd.click(CARD + '//button[normalize-space(.)="详情"]', 'xpath')
        wd.wait(lambda: 'horizon.markdown' in detail_text(), 'correct bundled Markdown extension detail')
        result.setdefault('pluginGui', {})['initialStateLabel'] = state_text()
        wd.button_text('权限', DETAIL)
        wd.wait(lambda: wd.js('return document.querySelector(arguments[0])?.innerText.includes(arguments[1]);', '.plugin-permissions', 'project.read'), 'declared project.read permission rendered')
        capture('21-plugin-permissions')
        wd.button_text('提供的能力', DETAIL)
        wd.wait(lambda: '打开Markdown 预览' in detail_text(), 'declared Markdown command rendered')
        wd.button_text('概览', DETAIL)
        if state_text() == '已禁用':
            wd.button_text('启用', DETAIL)
            wd.wait(enabled_state, 'Markdown enabled through visible control')
        no_plugin_error()

    check('plugin detail permissions and contribution tabs via native UI', inspect)

    def cancel_reopen():
        for attempt in range(2):
            wd.button_text('停用', DETAIL)
            wait_stop()
            if attempt == 0:
                capture('22-plugin-disable-confirmation')
                wd.button_text('取消', DIALOG)
            else:
                wd.click('dialog.plugin-dialog[open] button[aria-label="关闭对话框"]')
            wd.wait(no_dialog, 'plugin disable cancellation dismissed')
            assert enabled_state(), 'Cancel unexpectedly disabled Markdown'
            no_plugin_error()
        capture('23-plugin-cancelled-twice')

    check('plugin disable cancel and reopen with both cancel controls', cancel_reopen)

    def disable_enable():
        wd.button_text('停用', DETAIL)
        wait_stop()
        wd.button_text('保留恢复稿并停用', DIALOG)
        wd.wait(no_dialog, 'plugin disable operation completed')
        wd.wait(lambda: state_text() == '已禁用', 'Markdown actually disabled')
        no_plugin_error()
        capture('24-plugin-disabled')
        wd.button_text('启用', DETAIL)
        wd.wait(enabled_state, 'Markdown enabled again')
        no_plugin_error()
        capture('25-plugin-enabled-again')
        wd.button_text('返回已安装', DETAIL)
        # Opening details anew checks the catalogue-refreshed state, not only the
        # already-mounted detail's text after the operation.
        wd.type('input[aria-label="搜索扩展"]', 'horizon.markdown')
        wd.click(CARD + '//button[normalize-space(.)="详情"]', 'xpath')
        wd.wait(lambda: 'horizon.markdown' in detail_text(), 'reopened Markdown detail')
        assert enabled_state(), 'Reopened catalogue lost the enabled state'
        result['pluginGui'].update(extensionId='horizon.markdown', scope='global',
                                   finalStateLabel=state_text(),
                                   actualInstanceStopCovered=False,
                                   permissionGrantCovered=False,
                                   packageInstallCovered=False)
        wd.button_text('返回工作台', '//section[@aria-label="插件中心"]//')
        wd.wait(lambda: wd.js('return !document.querySelector(arguments[0]);', 'section.plugin-center'), 'returned from plugins to workbench')

    check('plugin actual disable and re-enable with catalogue reopen', disable_enable)


def enable_terminal(wd, check, capture, result):
    """Enable default-off terminal via native plugin UI before terminal testing."""
    card = '//article[contains(concat(" ", normalize-space(@class), " "), " plugin-card ")][.//h3[normalize-space(.)="终端"]]'

    def flow():
        wd.click('header.topbar button[aria-label="插件中心"]')
        wd.wait(lambda: wd.find('input[aria-label="搜索扩展"]'), 'plugin catalogue before terminal enable')
        wd.click('select[aria-label="操作范围"] option[value="global"]')
        wd.wait(lambda: wd.js('return document.querySelector(arguments[0])?.value === arguments[1];', 'select[aria-label="操作范围"]', 'global'), 'terminal enable scope global')
        wd.type('input[aria-label="搜索扩展"]', 'horizon.terminal')
        wd.click(card + '//button[normalize-space(.)="详情"]', 'xpath')
        wd.wait(lambda: wd.js('return document.querySelector(arguments[0])?.innerText.includes(arguments[1]);', 'section[aria-label="扩展详情"]', 'horizon.terminal'), 'correct terminal plugin detail')
        state = wd.js('return document.querySelector(arguments[0])?.textContent.trim();', '.plugin-detail-heading .plugin-state')
        result['terminalEnableGui'] = {'extensionId': 'horizon.terminal', 'initialStateLabel': state, 'scope': 'global'}
        if state == '已禁用':
            wd.button_text('启用', DETAIL)
        wd.wait(lambda: wd.js('return arguments[1].includes(document.querySelector(arguments[0])?.textContent.trim());', '.plugin-detail-heading .plugin-state', ['待激活', '运行中', '启动中', '已休眠']), 'terminal plugin enabled')
        errors = wd.js('return Array.from(document.querySelectorAll(arguments[0])).map(e => e.innerText).filter(Boolean);', '.plugin-center .plugin-error')
        assert not errors, f'Terminal plugin enable UI errors: {errors}'
        capture('18-terminal-plugin-enabled')
        wd.button_text('返回工作台', '//section[@aria-label="插件中心"]//')
        wd.wait(lambda: wd.js('return !document.querySelector(arguments[0]);', 'section.plugin-center'), 'workbench after terminal enable')

    check('enable terminal capability through native plugin UI', flow)
