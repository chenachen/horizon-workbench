export type DesktopPlatform = 'macos' | 'windows' | 'linux' | 'unknown';

export function detectPlatform(
  platform = typeof navigator === 'undefined' ? '' : navigator.platform,
  userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent,
): DesktopPlatform {
  const value = `${platform} ${userAgent}`;
  if (/\b(?:Win32|Win64|Windows|WinCE)\b/i.test(value)) return 'windows';
  if (/mac/i.test(value)) return 'macos';
  if (/linux/i.test(value)) return 'linux';
  return 'unknown';
}

export const platform = detectPlatform();
export const platformLabel = { macos: 'macOS', windows: 'Windows', linux: 'Linux', unknown: '本机' }[platform];
export const defaultLaunchShell = platform === 'windows' ? 'powershell.exe' : platform === 'macos' ? '/bin/zsh' : '/bin/sh';

export const revealFileLabel = { macos: '在 Finder 中显示', windows: '在资源管理器中显示', linux: '在文件管理器中显示', unknown: '在文件管理器中显示' }[platform];
export const trashFileLabel = platform === 'macos' ? '移到废纸篓' : '移到回收站';
