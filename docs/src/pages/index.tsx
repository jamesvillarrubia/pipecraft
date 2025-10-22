import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import HomepageFeatures from '@site/src/components/HomepageFeatures';

import styles from './index.module.css';

function HomepageHeader() {
  return (
    <header className={clsx('hero', styles.heroBanner)}>
      <div className="container">
        <div style={{
          maxWidth: '800px',
          width: '100%',
          margin: '0 auto 2rem',
          overflow: 'hidden',
          height: '200px',
          display: 'flex',
          alignItems: 'center'
        }}>
          <img
            src="https://raw.githubusercontent.com/jamesvillarrubia/pipecraft/main/assets/logo_banner.png"
            alt="PipeCraft"
            style={{
              width: '100%',
              transform: 'scale(1.43)',
              objectFit: 'cover'
            }}
          />
        </div>
        <div className={styles.buttons}>
          <Link
            className="button button--secondary button--lg"
            to="/docs">
            Get Started - 5min ⏱️
          </Link>
        </div>
        <div className={styles.heroCode}>
          <pre>
            <code>
              npm install -g pipecraft{'\n'}
              pipecraft init{'\n'}
              pipecraft generate
            </code>
          </pre>
        </div>
      </div>
    </header>
  );
}

export default function Home(): JSX.Element {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title={`${siteConfig.title} - Automated CI/CD for Trunk-Based Development`}
      description="Automated CI/CD pipeline generator for trunk-based development workflows. Generate GitHub Actions workflows with domain-based change detection and semantic versioning.">
      <HomepageHeader />
      <main>
        <HomepageFeatures />
      </main>
    </Layout>
  );
}
