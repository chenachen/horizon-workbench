import { FileText } from 'lucide-react';
export function FileKindIcon({ path }: { path: string }) {
  const extension = path.split('.').pop()?.toLowerCase();
  const symbol = ['ts', 'tsx'].includes(extension ?? '') ? 'TS' : ['js', 'jsx', 'mjs', 'cjs'].includes(extension ?? '') ? 'JS' : ['css', 'scss', 'sass', 'less'].includes(extension ?? '') ? '#' : extension === 'json' ? '{}' : ['md', 'markdown'].includes(extension ?? '') ? 'M↓' : ['html', 'xml', 'svg'].includes(extension ?? '') ? '<>' : extension === 'py' ? 'Py' : extension === 'rs' ? 'Rs' : '';
  return symbol ? <span className="file-kind-icon" aria-hidden="true">{symbol}</span> : <FileText className="file-kind-default" size={14} aria-hidden="true" />;
}
