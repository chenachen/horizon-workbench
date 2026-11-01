import { Component, type ReactNode, type ErrorInfo } from 'react';
import { AlertCircle } from 'lucide-react';

export class ErrorBoundary extends Component<{ children: ReactNode; name?: string; resetKey?: string }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Horizon UI failure', error.message, info.componentStack); }
  componentDidUpdate(previous: Readonly<{ children: ReactNode; name?: string; resetKey?: string }>) {
    if (previous.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }
  render() {
    if (this.state.error) return <div className="error-state" role="alert"><AlertCircle size={24} /><h3>{this.props.name ?? '界面'}暂时不可用</h3><p>{this.state.error.message}</p><button onClick={() => this.setState({ error: null })}>重试</button></div>;
    return this.props.children;
  }
}
