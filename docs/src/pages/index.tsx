import Link from '@docusaurus/Link'
import useDocusaurusContext from '@docusaurus/useDocusaurusContext'
import HomepageFeatures from '@site/src/components/HomepageFeatures'
import Layout from '@theme/Layout'
import clsx from 'clsx'

import styles from './index.module.css'

function HomepageHeader() {
  return (
    <header className={clsx('hero', styles.heroBanner)}>
      <div className="container">
        <div
          style={{
            maxWidth: '800px',
            width: '100%',
            margin: '0 auto 2rem',
            overflow: 'hidden',
            height: '200px',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          <img
            src="/img/logo_banner_trans.png"
            alt="PipeCraft"
            style={{
              width: '100%',
              transform: 'scale(1.3)',
              objectFit: 'cover'
            }}
          />
        </div>
        <div className={styles.buttons}>
          <Link className="button button--secondary button--lg" to="/docs">
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
  )
}

export default function Home(): JSX.Element {
  const { siteConfig } = useDocusaurusContext()
  return (
    <Layout
      title={`${siteConfig.title} - Battle-Tested CI/CD Templates`}
      description="Skip the debugging cycles. Generate battle-tested CI/CD workflows into your repository with best practices built in. Fully customizable, completely yours."
    >
      <HomepageHeader />
      <main>
        <HomepageFeatures />
      </main>
    </Layout>
  )
}
