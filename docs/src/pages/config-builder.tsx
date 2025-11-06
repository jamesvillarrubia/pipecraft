import React from 'react';
import Layout from '@theme/Layout';
import ConfigBuilder from '@site/src/components/ConfigBuilder';

export default function ConfigBuilderPage() {
  return (
    <Layout
      title="Configuration Builder"
      description="Interactive configuration builder for PipeCraft - Create your CI/CD pipeline configuration with visual feedback"
    >
      <div style={{ padding: '2rem 0', background: 'var(--ifm-background-color)' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 1rem' }}>
          <header style={{ marginBottom: '2rem' }}>
            <h1 style={{ color: 'var(--ifm-heading-color)' }}>PipeCraft Configuration Builder</h1>
            <p style={{ fontSize: '1.2rem', color: 'var(--ifm-font-color-secondary)' }}>
              Create your CI/CD pipeline configuration with an interactive form and real-time visual feedback.
            </p>
          </header>

          <div style={{
            background: 'var(--ifm-background-surface-color)',
            padding: '1.5rem',
            borderRadius: '8px',
            marginBottom: '2rem',
            borderLeft: '4px solid var(--ifm-color-primary)',
            color: 'var(--ifm-font-color-base)'
          }}>
            <h3 style={{ marginTop: 0, color: 'var(--ifm-heading-color)' }}>How to Use</h3>
            <ol style={{ marginBottom: 0, color: 'var(--ifm-font-color-base)' }}>
              <li><strong>Fill out the form</strong> on the left to configure your CI/CD pipeline settings</li>
              <li><strong>Watch the diagram</strong> update in real-time as you make changes</li>
              <li><strong>See the YAML</strong> configuration generate live on the right</li>
              <li><strong>Click &quot;Copy Configuration&quot;</strong> to copy the YAML to your clipboard</li>
              <li><strong>Paste into a <code>.pipecraftrc</code> file</strong> in your project root</li>
              <li><strong>Run <code>pipecraft generate</code></strong> to create your workflows</li>
            </ol>
          </div>

          <ConfigBuilder />

          <div style={{
            marginTop: '3rem',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '2rem'
          }}>
            <div style={{
              padding: '2rem',
              background: 'var(--ifm-background-surface-color)',
              borderRadius: '8px',
              color: 'var(--ifm-font-color-base)'
            }}>
              <h2 style={{ color: 'var(--ifm-heading-color)', marginTop: 0 }}>Next Steps</h2>
              <p style={{ color: 'var(--ifm-font-color-base)' }}>After copying your configuration:</p>
              <ol style={{ color: 'var(--ifm-font-color-base)', marginBottom: 0 }}>
                <li>Save the configuration to <code>.pipecraftrc</code> in your project root</li>
                <li>Validate your configuration: <code>pipecraft validate</code></li>
                <li>Generate GitHub Actions workflows: <code>pipecraft generate</code></li>
                <li>Set up your branch structure: <code>pipecraft setup</code></li>
                <li>Configure GitHub permissions: <code>pipecraft setup-github</code></li>
              </ol>
            </div>

            <div style={{
              padding: '2rem',
              background: 'var(--ifm-background-surface-color)',
              borderRadius: '8px',
              color: 'var(--ifm-font-color-base)'
            }}>
              <h2 style={{ color: 'var(--ifm-heading-color)', marginTop: 0 }}>Learn More</h2>
              <p style={{ color: 'var(--ifm-font-color-base)', marginBottom: '1rem' }}>Explore the documentation:</p>
              <ul style={{ color: 'var(--ifm-font-color-base)', marginBottom: 0 }}>
                <li><a href="/docs/intro">Getting Started Guide</a></li>
                <li><a href="/docs/configuration-reference">Configuration Reference</a></li>
                <li><a href="/docs/cli-reference">CLI Commands</a></li>
                <li><a href="/docs/examples">Example Configurations</a></li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
