// E:\Stryde\components\ErrorBoundary.tsx
import React, { Component, ReactNode } from 'react';
import { View, Text, Button } from 'react-native';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <View>
          <Text>Something went wrong: {this.state.error?.message || 'Unknown error'}</Text>
          <Button
            title="Retry"
            onPress={() => this.setState({ hasError: false, error: null })}
          />
        </View>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;