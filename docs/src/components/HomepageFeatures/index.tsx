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
    title: 'Battle-Tested Templates',
    emoji: '🛡️',
    description: (
      <>
        Start with proven CI/CD patterns instead of debugging YAML from scratch.
        Templates include trunk-based development, domain testing, and versioning.
      </>
    ),
  },
  {
    title: 'You Own The Code',
    emoji: '🔑',
    description: (
      <>
        Generated workflows live in your repository. Customize freely—add deployments,
        integrate tools, modify jobs. It's your code, not a black box.
      </>
    ),
  },
  {
    title: 'Smart Monorepo Support',
    emoji: '🎯',
    description: (
      <>
        Domain-based change detection tests only what changed. Configure path patterns
        once, save hours of CI time on every push.
      </>
    ),
  },
  {
    title: 'Safe Regeneration',
    emoji: '♻️',
    description: (
      <>
        Regenerate from templates when needed. Your custom jobs and deployment steps
        are preserved while core workflow structure updates.
      </>
    ),
  },
  {
    title: 'Production Ready',
    emoji: '✅',
    description: (
      <>
        397 passing tests, 100% JSDoc coverage, comprehensive error handling.
        Used in production by teams managing complex monorepos.
      </>
    ),
  },
  {
    title: 'Best Practices Built In',
    emoji: '⚡',
    description: (
      <>
        Semantic versioning, conventional commits, branch promotions, changelog
        generation. Get all the tedious details right from day one.
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
