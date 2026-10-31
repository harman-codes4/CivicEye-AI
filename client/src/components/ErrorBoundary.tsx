import React, { useState, useEffect } from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by ErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <div className="p-6 text-center text-slate-600"><h3 className="text-red-600 mb-4">Error</h3><p>An unexpected error occurred. The development team has been notified.</p><button onClick={() => this.setState({ hasError: false })} className="mt-4 px-4 py-2 bg-teal-600 text-white rounded">Try Again</button></div>;
    }
    return this.props.children;
  }
}