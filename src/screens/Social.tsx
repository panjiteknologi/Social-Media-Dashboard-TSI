import { useMemo } from 'react';
import { Requires, unavailableLabel, useCapabilityStates } from '../components/Requires';
import { Card, Chip } from '../components/primitives';
import { POSTS, SOCIAL_SUMMARY, SOCIAL_TABS, SOCIAL_TRENDS, type SocialTab } from '../data/growth';
import { platformTone, statusTone } from '../lib/theme';

export function Social({
  tab,
  onTabChange,
}: {
  tab: SocialTab;
  onTabChange: (tab: SocialTab) => void;
}) {
  const stateOf = useCapabilityStates();
  const posts = useMemo(
    () => POSTS.filter((post) => tab === 'All' || post.platform === tab),
    [tab],
  );

  return (
    <div>
      <div className="mb-20">
        <div className="page-title">Social Media</div>
        <div className="page-subtitle">Instagram, Facebook &amp; LinkedIn command center</div>
      </div>

      <div className="tab-row" role="group" aria-label="Filter by platform">
        {SOCIAL_TABS.map((label) => (
          <button
            key={label}
            type="button"
            className="tab-pill"
            aria-pressed={tab === label}
            onClick={() => onTabChange(label)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="social-summary">
        {SOCIAL_SUMMARY.map((item) => {
          const state = stateOf(item.capability);
          return (
            <div className="social-summary__card" key={item.label}>
              <div className="social-summary__label">{item.label}</div>
              {state === 'available' ? (
                <>
                  <div className="social-summary__value">{item.value}</div>
                  <div className="social-summary__change">{item.change}</div>
                </>
              ) : (
                <>
                  <div className="social-summary__value kpi__value--empty">—</div>
                  <div className="social-summary__change social-summary__change--muted">
                    {unavailableLabel(state)}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="dash-grid">
        <div>
          <div className="section-title">Scheduled Posts</div>
          <Requires capability={tab === 'LinkedIn' ? 'linkedin' : 'meta'}>
            <div className="post-grid">
              {posts.map((post) => (
                <div className="post-card" key={post.caption}>
                  <div className="post-card__visual">post visual</div>
                  <div className="post-card__body">
                    <div className="post-card__head">
                      <Chip tone={platformTone(post.platform)}>{post.platform}</Chip>
                      <Chip tone={statusTone(post.status)}>{post.status}</Chip>
                    </div>
                    <div className="post-card__caption">{post.caption}</div>
                    <div className="post-card__foot">
                      <span>{post.campaign}</span>
                      <span>{post.date}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {posts.length === 0 ? (
              <div className="empty-note">No scheduled posts for this platform.</div>
            ) : null}
          </Requires>
        </div>

        <Card className="card--md">
          <div className="card-title card-title--sm mb-14">AI Social Trend Intelligence</div>
          <Requires capability="socialTrends">
            {SOCIAL_TRENDS.map((item) => (
              <div className="trend" key={item.trend}>
                <div className="trend__text">{item.trend}</div>
                <button type="button" className="link-cta">
                  {item.action} →
                </button>
              </div>
            ))}
          </Requires>
        </Card>
      </div>
    </div>
  );
}
