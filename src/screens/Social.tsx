import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { SocialPlatformKey } from '../../shared/social';
import { useSocialOverview } from '../api/social';
import { useCurrentUser } from '../components/AuthGate';
import { Requires, unavailableLabel, useCapabilityStates } from '../components/Requires';
import { AddAccountModal, ConnectedAccounts, ConnectPicker, followerChange } from '../components/SocialAccounts';
import { Card, Chip } from '../components/primitives';
import { POSTS, SOCIAL_SUMMARY, SOCIAL_TABS, SOCIAL_TRENDS, type SocialTab } from '../data/growth';
import { formatNumber } from '../lib/format';
import { platformTone, statusTone } from '../lib/theme';

const TAB_PLATFORMS: Partial<Record<SocialTab, SocialPlatformKey>> = {
  Facebook: 'facebook',
  Instagram: 'instagram',
};

/** Followers for one platform, from the connected accounts. */
function FollowersCard({ label, platform }: { label: string; platform: SocialPlatformKey }) {
  const overview = useSocialOverview();
  const totals = overview.data?.totals[platform];
  const change = followerChange(totals?.followersChange ?? null);

  return (
    <div className="social-summary__card">
      <div className="social-summary__label">{label}</div>
      {totals && totals.followers !== null ? (
        <>
          <div className="social-summary__value">{formatNumber(totals.followers)}</div>
          <div className={change ? 'social-summary__change' : 'social-summary__change social-summary__change--muted'}>
            {change ?? `${totals.accounts} account${totals.accounts === 1 ? '' : 's'}, no comparison yet`}
          </div>
        </>
      ) : (
        <>
          <div className="social-summary__value kpi__value--empty">—</div>
          <div className="social-summary__change social-summary__change--muted">
            {overview.isPending ? 'Loading…' : 'Not connected'}
          </div>
        </>
      )}
    </div>
  );
}

export function Social({
  tab,
  onTabChange,
}: {
  tab: SocialTab;
  onTabChange: (tab: SocialTab) => void;
}) {
  const user = useCurrentUser();
  const canEdit = user.role === 'admin';
  const stateOf = useCapabilityStates();
  const [params, setParams] = useSearchParams();
  const [adding, setAdding] = useState(false);
  // Set by the server when Facebook sends the browser back here.
  const [requestId, setRequestId] = useState(() => params.get('connect'));
  const connectError = params.get('connect_error');
  const connected = params.get('connected');

  const posts = useMemo(
    () => POSTS.filter((post) => tab === 'All' || post.platform === tab),
    [tab],
  );

  /** Drops the values Facebook's redirect left in the URL, keeping the platform tab. */
  const clearConnectParams = () =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete('connect');
        next.delete('connect_error');
        next.delete('connected');
        return next;
      },
      { replace: true },
    );

  return (
    <div>
      <div className="page-head mb-20">
        <div>
          <div className="page-title">Social Media</div>
          <div className="page-subtitle">Instagram, Facebook &amp; LinkedIn command center</div>
        </div>
      </div>

      {connectError ? (
        <div className="social-notice social-notice--warn mb-20" role="alert">
          <strong>The account was not connected.</strong> {connectError}
          <button type="button" className="link-cta social-notice__close" onClick={clearConnectParams}>
            Dismiss
          </button>
        </div>
      ) : null}

      {connected ? (
        <div className="social-notice social-notice--ok mb-20" role="status">
          <strong>{connected} is connected.</strong> Followers are recorded every morning from now on.
          <button type="button" className="link-cta social-notice__close" onClick={clearConnectParams}>
            Dismiss
          </button>
        </div>
      ) : null}

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
        <FollowersCard label="Instagram Followers" platform="instagram" />
        {SOCIAL_SUMMARY.filter((item) => item.capability === 'linkedin').map((item) => (
          <SummaryCard key={item.label} item={item} state={stateOf(item.capability)} />
        ))}
        <FollowersCard label="Facebook Followers" platform="facebook" />
        {SOCIAL_SUMMARY.filter((item) => !item.label.endsWith('Followers')).map((item) => (
          <SummaryCard key={item.label} item={item} state={stateOf(item.capability)} />
        ))}
      </div>

      {tab === 'LinkedIn' ? null : (
        <ConnectedAccounts platform={TAB_PLATFORMS[tab] ?? null} canEdit={canEdit} onAdd={() => setAdding(true)} />
      )}

      <div className="dash-grid">
        <div>
          <div className="section-title">Scheduled Posts</div>
          <Requires capability={tab === 'LinkedIn' ? 'linkedin' : 'socialPublishing'}>
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

      {adding ? (
        <AddAccountModal
          onClose={() => setAdding(false)}
          onFound={(id) => {
            setAdding(false);
            setRequestId(id);
          }}
        />
      ) : null}
      {requestId ? (
        <ConnectPicker
          requestId={requestId}
          onClose={() => {
            setRequestId(null);
            clearConnectParams();
          }}
        />
      ) : null}
    </div>
  );
}

function SummaryCard({
  item,
  state,
}: {
  item: (typeof SOCIAL_SUMMARY)[number];
  state: ReturnType<ReturnType<typeof useCapabilityStates>>;
}) {
  return (
    <div className="social-summary__card">
      <div className="social-summary__label">{item.label}</div>
      {state === 'available' ? (
        <>
          <div className="social-summary__value">{item.value}</div>
          <div className="social-summary__change">{item.change}</div>
        </>
      ) : (
        <>
          <div className="social-summary__value kpi__value--empty">—</div>
          <div className="social-summary__change social-summary__change--muted">{unavailableLabel(state)}</div>
        </>
      )}
    </div>
  );
}
