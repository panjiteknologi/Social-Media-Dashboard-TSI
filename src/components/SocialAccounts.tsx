import { useEffect, useId, useState, type ReactNode } from 'react';
import type { ConnectSelection, SocialAccount, SocialPlatformKey } from '../../shared/social';
import {
  useCompleteConnect,
  useConnectOptions,
  useConnectRequest,
  useConnectWithToken,
  useDisconnectAccount,
  useRefreshFollowers,
  useSocialOverview,
} from '../api/social';
import { formatDateTime, formatNumber } from '../lib/format';
import { initials } from '../lib/initials';
import { platformTone } from '../lib/theme';
import { Card, Chip } from './primitives';
import { QueryState } from './QueryState';

export const PLATFORM_LABELS: Record<SocialPlatformKey, 'Facebook' | 'Instagram'> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
};

const STATUS_LABELS: Record<SocialAccount['status'], string> = {
  active: 'Active',
  needs_reconnect: 'Reconnect',
  error: 'Sync failed',
};

/** A signed number of followers gained, or nothing when there is no comparison yet. */
export function followerChange(change: number | null): string | null {
  if (change === null) return null;
  return `${change > 0 ? '+' : ''}${formatNumber(change)} in 28 days`;
}

function Avatar({ account }: { account: { name: string; pictureUrl: string | null } }) {
  const [broken, setBroken] = useState(false);
  if (account.pictureUrl && !broken) {
    return <img className="social-avatar" src={account.pictureUrl} alt="" onError={() => setBroken(true)} />;
  }
  return <span className="social-avatar social-avatar--initials">{initials({ name: account.name, email: account.name })}</span>;
}

// ------------------------------------------------------------------ modal

function Modal({
  title,
  subtitle,
  onClose,
  children,
  foot,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  foot?: ReactNode;
}) {
  const titleId = useId();
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="drawer-scrim prompt-scrim" onClick={onClose}>
      <div
        className="prompt-modal social-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="prompt-modal__head">
          <div>
            <div className="prompt-modal__title" id={titleId}>
              {title}
            </div>
            {subtitle ? <div className="prompt-modal__subtitle">{subtitle}</div> : null}
          </div>
          <button type="button" className="drawer__close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="social-modal__body">{children}</div>
        {foot ? <div className="prompt-modal__foot">{foot}</div> : null}
      </div>
    </div>
  );
}

// --------------------------------------------------------- add an account

function LoginChoice({
  href,
  title,
  detail,
  cta,
  available,
}: {
  href: string;
  title: string;
  detail: ReactNode;
  cta: string;
  available: boolean;
}) {
  return (
    <div className={available ? 'social-choice' : 'social-choice social-choice--off'}>
      <span className="social-choice__title">{title}</span>
      <span className="social-choice__detail">{detail}</span>
      {available ? (
        <a className="btn btn--primary social-choice__button" href={href}>
          {cta}
        </a>
      ) : (
        <span className="social-choice__off">
          Not turned on for this server yet. Whoever installed Content Machine sets it up once.
        </span>
      )}
    </div>
  );
}

/** For a System User token from Meta Business Settings: never expires, needs no one to log in. */
function TokenOption({ onFound }: { onFound: (requestId: string) => void }) {
  const [token, setToken] = useState('');
  const connect = useConnectWithToken();

  return (
    <details className="social-advanced">
      <summary>Advanced: connect with a System User token</summary>
      <form
        className="social-token"
        onSubmit={(event) => {
          event.preventDefault();
          connect.mutate(token.trim(), { onSuccess: ({ id }) => onFound(id) });
        }}
      >
        <label className="settings-field">
          <span className="settings-field__label">Access token</span>
          <textarea
            rows={3}
            value={token}
            onChange={(event) => setToken(event.target.value)}
            spellCheck={false}
            autoComplete="off"
          />
          <span className="settings-field__hint">
            In Meta Business Settings → Users → System users, assign your Pages to a system user and generate a token
            for the Content Machine app. Paste it here to pick the Pages it can manage.
          </span>
        </label>
        <div className="settings-form__actions">
          <button type="submit" className="btn btn--dark settings-form__button" disabled={connect.isPending || !token.trim()}>
            {connect.isPending ? 'Checking…' : 'Find accounts'}
          </button>
          {connect.isError ? (
            <span className="settings-form__error" role="alert">
              {connect.error.message}
            </span>
          ) : null}
        </div>
      </form>
    </details>
  );
}

export function AddAccountModal({ onClose, onFound }: { onClose: () => void; onFound: (requestId: string) => void }) {
  const options = useConnectOptions();

  return (
    <Modal title="Add a social account" subtitle="Log in to the account you want to add. That is all." onClose={onClose}>
      <QueryState query={options}>
        {(data) =>
          data.secretsKeySet ? (
            <>
              <div className="social-choices">
                <LoginChoice
                  href="/api/social/meta/connect"
                  title="Facebook Page"
                  detail="Log in with Facebook and tick the Pages to add."
                  cta="Continue with Facebook"
                  available={data.facebook}
                />
                <LoginChoice
                  href="/api/social/instagram/connect"
                  title="Instagram"
                  detail={
                    <>
                      Log in with Instagram. Works for any Business or Creator account, no Facebook Page needed. A
                      personal account can switch for free in Instagram under Settings → Account type and tools.
                    </>
                  }
                  cta="Continue with Instagram"
                  available={data.instagram}
                />
              </div>
              <div className="social-later">LinkedIn: on hold for now.</div>
              {data.facebook ? <TokenOption onFound={onFound} /> : null}
            </>
          ) : (
            <div className="social-notice social-notice--warn" role="status">
              <strong>Social logins are not turned on for this server yet.</strong> Whoever installed Content Machine
              sets them up once, following docs/Social Media Setup.md. After that, adding an account is a single login.
            </div>
          )
        }
      </QueryState>
    </Modal>
  );
}

// ------------------------------------------------- pick what to connect

export function ConnectPicker({ requestId, onClose }: { requestId: string; onClose: () => void }) {
  const request = useConnectRequest(requestId);
  const complete = useCompleteConnect();
  const [picked, setPicked] = useState<Record<string, ConnectSelection>>({});

  // Everything Facebook shared is ticked to begin with: the person already chose them on Facebook.
  useEffect(() => {
    if (!request.data) return;
    setPicked(
      Object.fromEntries(
        request.data.pages.map((page) => [page.id, { pageId: page.id, facebook: true, instagram: Boolean(page.instagram) }]),
      ),
    );
  }, [request.data]);

  const toggle = (pageId: string, field: 'facebook' | 'instagram') =>
    setPicked((current) => {
      const selection = current[pageId] ?? { pageId, facebook: false, instagram: false };
      return { ...current, [pageId]: { ...selection, [field]: !selection[field] } };
    });

  const selections = Object.values(picked).filter((selection) => selection.facebook || selection.instagram);
  const count = selections.reduce((sum, selection) => sum + Number(selection.facebook) + Number(selection.instagram), 0);

  return (
    <Modal
      title="Choose accounts to add"
      subtitle="Content Machine records followers for each account you add."
      onClose={onClose}
      foot={
        request.data ? (
          <>
            {complete.isError ? (
              <span className="settings-form__error" role="alert">
                {complete.error.message}
              </span>
            ) : null}
            <button type="button" className="btn btn--ghost settings-form__button" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn--primary settings-form__button"
              disabled={count === 0 || complete.isPending}
              onClick={() => complete.mutate({ id: requestId, selections }, { onSuccess: onClose })}
            >
              {complete.isPending ? 'Adding…' : `Add ${count} account${count === 1 ? '' : 's'}`}
            </button>
          </>
        ) : null
      }
    >
      {request.isError ? (
        <div className="social-notice social-notice--warn" role="alert">
          {request.error.message}
        </div>
      ) : (
      <QueryState query={request}>
        {(data) => (
          <div className="social-pick">
            {data.pages.map((page) => (
              <div className="social-pick__page" key={page.id}>
                <label className="social-pick__row">
                  <input
                    type="checkbox"
                    checked={picked[page.id]?.facebook ?? false}
                    onChange={() => toggle(page.id, 'facebook')}
                  />
                  <Avatar account={page} />
                  <span className="social-pick__name">
                    {page.name}
                    <span className="social-pick__meta">
                      Facebook Page
                      {page.followers !== null ? ` · ${formatNumber(page.followers)} followers` : ''}
                      {page.connected ? ' · already added, the token is refreshed' : ''}
                    </span>
                  </span>
                </label>
                {page.instagram ? (
                  <label className="social-pick__row social-pick__row--child">
                    <input
                      type="checkbox"
                      checked={picked[page.id]?.instagram ?? false}
                      onChange={() => toggle(page.id, 'instagram')}
                    />
                    <Avatar account={{ name: page.instagram.username, pictureUrl: page.instagram.pictureUrl }} />
                    <span className="social-pick__name">
                      @{page.instagram.username}
                      <span className="social-pick__meta">
                        Instagram
                        {page.instagram.followers !== null ? ` · ${formatNumber(page.instagram.followers)} followers` : ''}
                        {page.instagram.connected ? ' · already added, the token is refreshed' : ''}
                      </span>
                    </span>
                  </label>
                ) : (
                  <div className="social-pick__none">
                    No Instagram account came with this Page. Add Instagram with Continue with Instagram.
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </QueryState>
      )}
    </Modal>
  );
}

// ------------------------------------------------------ connected accounts

function AccountRow({ account, canEdit }: { account: SocialAccount; canEdit: boolean }) {
  const disconnect = useDisconnectAccount();
  const change = followerChange(account.followersChange);
  const tone: Record<SocialAccount['status'], 'ok' | 'warn' | 'bad'> = {
    active: 'ok',
    needs_reconnect: 'warn',
    error: 'bad',
  };

  return (
    <div className="social-account">
      <Avatar account={account} />
      <div className="social-account__who">
        <div className="social-account__name">
          {account.platform === 'instagram' ? `@${account.username ?? account.name}` : account.name}
        </div>
        <div className="social-account__meta">
          <Chip tone={platformTone(PLATFORM_LABELS[account.platform])}>{PLATFORM_LABELS[account.platform]}</Chip>
          {account.pageName ? <span>via {account.pageName}</span> : null}
          {account.connection === 'instagram' ? <span>Instagram login</span> : null}
        </div>
      </div>
      <div className="social-account__numbers">
        <div className="social-account__followers">
          {account.followers !== null ? formatNumber(account.followers) : '—'}
          <span> followers</span>
        </div>
        <div className="social-account__change">
          {change ?? (account.trackedSince ? `Tracking since ${account.trackedSince}` : 'Not recorded yet')}
        </div>
      </div>
      <div className="social-account__status">
        <span
          className={`social-status social-status--${tone[account.status]}`}
          title={account.lastError ?? (account.lastSyncedAt ? `Checked ${formatDateTime(account.lastSyncedAt)}` : undefined)}
        >
          {STATUS_LABELS[account.status]}
        </span>
        {account.status !== 'active' && account.lastError ? (
          <div className="social-account__error">{account.lastError}</div>
        ) : null}
      </div>
      {canEdit ? (
        <button
          type="button"
          className="link-cta social-account__remove"
          disabled={disconnect.isPending}
          onClick={() => {
            if (window.confirm(`Disconnect ${account.name}? Its follower history is deleted too.`)) {
              disconnect.mutate(account.id);
            }
          }}
        >
          Disconnect
        </button>
      ) : null}
    </div>
  );
}

export function ConnectedAccounts({
  platform,
  canEdit,
  onAdd,
}: {
  platform: SocialPlatformKey | null;
  canEdit: boolean;
  onAdd: () => void;
}) {
  const overview = useSocialOverview();
  const refresh = useRefreshFollowers();

  return (
    <Card className="mb-24">
      <div className="social-accounts__head">
        <div className="card-title">Connected accounts</div>
        <div className="social-accounts__actions">
          {overview.data?.accounts.length ? (
            <button
              type="button"
              className="btn btn--ghost settings-form__button"
              disabled={refresh.isPending}
              onClick={() => refresh.mutate()}
            >
              {refresh.isSuccess ? 'Refreshing…' : 'Refresh followers'}
            </button>
          ) : null}
          {canEdit ? (
            <button type="button" className="btn btn--primary" onClick={onAdd}>
              + Add account
            </button>
          ) : null}
        </div>
      </div>
      <QueryState query={overview}>
        {(data) => {
          const accounts = data.accounts.filter((account) => !platform || account.platform === platform);
          if (accounts.length === 0) {
            return (
              <div className="social-empty">
                <div className="social-empty__title">
                  {data.accounts.length === 0 ? 'No accounts connected yet' : 'No account on this platform yet'}
                </div>
                <div className="social-empty__detail">
                  {canEdit
                    ? 'Add your Facebook Page and Instagram account to start recording followers every day.'
                    : 'Ask an admin to add the Facebook Page and Instagram account.'}
                </div>
                {canEdit ? (
                  <button type="button" className="btn btn--primary social-empty__button" onClick={onAdd}>
                    + Add account
                  </button>
                ) : null}
              </div>
            );
          }
          return (
            <div className="social-accounts">
              {accounts.map((account) => (
                <AccountRow key={account.id} account={account} canEdit={canEdit} />
              ))}
            </div>
          );
        }}
      </QueryState>
      {refresh.isError ? (
        <div className="settings-form__error" role="alert">
          {refresh.error.message}
        </div>
      ) : null}
    </Card>
  );
}
