import React, { ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error: error }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <div className="min-h-screen bg-background p-6">
          <Card className="mx-auto max-w-2xl">
            <CardHeader>
              <CardTitle>Error occurred</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {this.state.error?.message.includes('Attempt to get default algod configuration')
                  ? 'Please make sure to set up your environment variables correctly. Create a .env file based on .env.template and fill in the required values. This controls the network and credentials for connections with Algod and Indexer.'
                  : this.state.error?.message}
              </p>
            </CardContent>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
