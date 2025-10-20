import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  Svg?: React.ComponentType<React.ComponentProps<'svg'>>;
  emoji?: string;
  description: JSX.Element;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Trunk-Based Development',
    emoji: '🌳',
    description: (
      <>
        Automate your trunk-based workflow with proper branch promotions,
        automated testing, and safe deployments from develop → staging → main.
      </>
    ),
  },
  {
    title: 'Domain-Based Change Detection',
    emoji: '🎯',
    description: (
      <>
        Perfect for monorepos. Only build and test what changed. Configure
        domains with path patterns and PipeCraft handles the rest.
      </>
    ),
  },
  {
    title: 'Semantic Versioning',
    emoji: '📦',
    description: (
      <>
        Automatic version bumps based on conventional commits. feat = minor,
        fix = patch, breaking = major. Simple and predictable.
      </>
    ),
  },
  {
    title: 'Idempotent Regeneration',
    emoji: '♻️',
    description: (
      <>
        Regenerate workflows safely. Preserves user comments and custom jobs.
        Only updates when configuration or templates change.
      </>
    ),
  },
  {
    title: 'Production Ready',
    emoji: '✅',
    description: (
      <>
        397 passing tests, 100% JSDoc coverage, comprehensive error handling.
        Battle-tested with real-world monorepo scenarios.
      </>
    ),
  },
  {
    title: 'Zero Configuration',
    emoji: '⚡',
    description: (
      <>
        Smart defaults that just work. One command to initialize,
        one command to generate. Customize when you need to.
      </>
    ),
  },
];

function Feature({title, emoji, description}: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        {emoji && <div className={styles.featureEmoji}>{emoji}</div>}
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): JSX.Element {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
