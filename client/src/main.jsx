import React, { Component } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './tailwind.css';
import './styles.css';
import './theme.css';

class AppErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) { return { error }; }

  componentDidCatch(error, info) {
    console.error('PrepAI render error:', error, info.componentStack);
  }

  render() {
    if (this.state.error) return <main className="render-error-page" role="alert"><div className="eyebrow">RECOVERABLE PAGE ERROR</div><h1>This page could not be displayed.</h1><p>Your saved data is stored separately. Reload the page to restore your workspace.</p><small>{this.state.error.message}</small><button className="button" type="button" onClick={() => window.location.assign('/')}>Reload PrepAI</button></main>;
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(<React.StrictMode><AppErrorBoundary><BrowserRouter><App /></BrowserRouter></AppErrorBoundary></React.StrictMode>);


